import { getSupabase } from '../_lib/ml.js';
import { autenticar } from '../_lib/auth.js';
import { canonizarEstado, ESTADOS, ESTADOS_VALIDOS } from '../../shared/estados.js';
import { ErrorPublico, responderError } from '../_lib/errores.js';
import { traerTodo, buscarPorIds } from '../_lib/consultas.js';
import { esUuid } from '../_lib/paquetes/comun.js';
import { generarXlsx, ESTILOS_XLSX } from '../_lib/xlsx.js';
import { formatearFecha, responderArchivo } from '../_lib/emision.js';
import { agruparConteos, COLUMNAS_ESTADO } from '../../shared/estadisticas.js';

// El cliente solo conoce UUIDs opacos (public_id). Los filtros llegan con ese
// UUID y hay que traducirlo al id interno antes de consultar paquete. El
// nombre viaja también: el Excel de estadísticas lo muestra como filtro.
async function resolver(supabase, tabla, publicId, filtroEmpresa) {
  let query = supabase.from(tabla).select('id, nombre').eq('public_id', publicId);
  if (filtroEmpresa != null) query = query.eq('idempresa', filtroEmpresa);
  const { data } = await query.maybeSingle();
  return data ?? null;
}

// GET /api/paquetes?historial=<public_id> — historial de estados de un paquete.
// Va en este mismo endpoint para no sumar una Serverless Function (límite 12
// del plan Hobby de Vercel).
async function historial(supabase, usuario, publicId, res) {
  if (!esUuid(publicId)) return res.status(400).json({ error: 'id de paquete inválido' });

  let query = supabase.from('paquete').select('id').eq('public_id', publicId);
  query = usuario.rol === 'transportista'
    ? query.eq('idtransportista', usuario.id)
    : query.eq('idempresa', usuario.id);
  const { data: paquete } = await query.maybeSingle();
  if (!paquete) return res.status(404).json({ error: 'Paquete no encontrado' });

  const { data, error } = await supabase
    .from('paquete_historial')
    .select('estado_anterior, estado_nuevo, idusuario, origen, created_at')
    .eq('idpaquete', paquete.id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const usuarios = await buscarPorIds(
    supabase,
    'usuario',
    'id, nombre',
    (data ?? []).map((h) => h.idusuario),
  );

  return res.json({
    historial: (data ?? []).map((h) => ({
      de: h.estado_anterior,
      a: h.estado_nuevo,
      usuario: usuarios.get(h.idusuario)?.nombre ?? null,
      origen: h.origen,
      fecha: h.created_at,
    })),
  });
}

const ANCHOS_PARTIDO = [30, 10, ...COLUMNAS_ESTADO.map(() => 14)];
const ANCHOS_DETALLE = [18, 26, 14, 38, 14, 22, 22, 16, 16];

// GET /api/paquetes?...&formato=xlsx — las estadísticas por partido de los
// paquetes filtrados, igual que la tabla de la pantalla, más una hoja con el
// detalle de cada paquete (cortada en MAX_DETALLE_XLSX filas; `truncado` lo
// avisa en la misma hoja).
function responderEstadisticas(res, { filas, totales }, paquetes, filtros, truncado = false) {
  const encabezado = (titulos) => titulos.map((v) => ({ v, s: ESTILOS_XLSX.encabezado }));
  const negrita = (v) => ({ v, s: ESTILOS_XLSX.negrita });

  const descripcion = [
    `Período: ${filtros.desde ? formatearFecha(filtros.desde) : 'inicio'} al ${
      filtros.hasta ? formatearFecha(filtros.hasta) : 'hoy'
    }`,
    `Seller: ${filtros.seller ?? 'Todos'}`,
    `Transportista: ${filtros.transportista ?? 'Todos'}`,
    `Estado: ${filtros.estado ?? 'Todos'}`,
  ];

  const resumen = {
    nombre: 'Por partido',
    columnas: ANCHOS_PARTIDO,
    filas: [
      [negrita('Estadísticas por partido')],
      ...descripcion.map((linea) => [linea]),
      [],
      encabezado(['Partido', 'Total', ...COLUMNAS_ESTADO.map((c) => c.label)]),
      ...filas.map((f) => [
        f.partido,
        f.total,
        ...COLUMNAS_ESTADO.map((c) => f[c.estado] ?? 0),
      ]),
      [],
      [
        negrita('Total'),
        negrita(totales.total),
        ...COLUMNAS_ESTADO.map((c) => negrita(totales[c.estado] ?? 0)),
      ],
    ],
  };

  const detalle = {
    nombre: 'Detalle',
    columnas: ANCHOS_DETALLE,
    filas: [
      ...(truncado
        ? [[negrita(
          `Detalle limitado a los ${paquetes.length.toLocaleString('es-AR')} paquetes más recientes. ` +
            'Acotá el período para ver el resto (la hoja "Por partido" incluye todos).',
        )], []]
        : []),
      encabezado([
        'Envío ML', 'Partido', 'Zona', 'Dirección', 'Estado',
        'Seller', 'Transportista', 'Fecha ingreso', 'Fecha entrega',
      ]),
      ...paquetes.map((p) => [
        p.idenvioml ?? '—',
        p.partido ?? '—',
        p.zona ?? '—',
        p.direccion || '—',
        p.estado ?? '—',
        p.seller ?? '—',
        p.transportista ?? '—',
        formatearFecha(p.fechaingreso),
        formatearFecha(p.fechaentrega),
      ]),
    ],
  };

  const sufijo = filtros.desde || filtros.hasta
    ? `-${filtros.desde ?? 'inicio'}_${filtros.hasta ?? 'hoy'}`
    : '';
  const nombre = `estadisticas-por-partido${sufijo}.xlsx`;
  return responderArchivo(
    res,
    generarXlsx([resumen, detalle]),
    nombre,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    nombre,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Listado, resumen y estadísticas
// ──────────────────────────────────────────────────────────────────────────
//
// GET /api/paquetes?<filtros>[&pagina=&limite=&orden=&dir=]
//     → { paquetes, total, pagina, limite }   una página del listado
// GET /api/paquetes?<filtros>&vista=resumen
//     → { total, porEstado }                  cantidades por estado (Inicio)
// GET /api/paquetes?<filtros>&vista=estadisticas
//     → { filas, totales }                    por partido (Estadísticas)
// GET /api/paquetes?<filtros>&formato=xlsx    → el Excel de Estadísticas
//
// Filtros: estado, sellerId, transportistaId, desde, hasta (YYYY-MM-DD),
// q (texto: ID de envío, comprador o dirección), abiertos=1 (Ingresado + En
// camino, para la pantalla del transportista).
//
// Pensado para volumen: nunca se trae la tabla entera. El listado es paginado
// y los conteos se hacen en Postgres (estadisticas_paquetes, ver
// migration-escala.sql).

const COLUMNAS_PAQUETE =
  'public_id, idenvioml, comprador, direccion, codigopostal, fechaingreso, fechaentrega, ' +
  'estado, idzona, idarea, idseller, idtransportista';

const LIMITE_POR_DEFECTO = 50;
// El transportista pide todos sus paquetes abiertos de una vez (abiertos=1).
const LIMITE_MAXIMO = 500;

// El detalle del Excel se corta acá: un .xlsx de cientos de miles de filas no
// entra en la memoria de la función ni lo abre Excel con comodidad. La hoja
// "Por partido" sí incluye siempre todos los paquetes.
const MAX_DETALLE_XLSX = 50_000;

// Solo columnas propias de la tabla: ordenar por seller/partido exigiría un
// join que PostgREST no puede hacer sin FK declarada.
const ORDENABLES = new Set(['fechaingreso', 'idenvioml', 'comprador', 'direccion', 'codigopostal', 'estado']);

const ABIERTOS = [ESTADOS.INGRESADO, ESTADOS.EN_CAMINO];

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// El texto va dentro de un filtro or() de PostgREST: se sacan los caracteres
// que tienen significado en esa sintaxis para que no se pueda inyectar otra
// condición.
function limpiarBusqueda(q) {
  return String(q ?? '')
    .replace(/[,()"\\*%:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function entero(valor, porDefecto, minimo, maximo) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(Math.max(n, minimo), maximo);
}

// Traduce los filtros del query string a: una función que los aplica a una
// query de paquete, los argumentos de estadisticas_paquetes() y la descripción
// que muestra el Excel.
async function prepararFiltros(supabase, usuario, query) {
  const { estado, sellerId, transportistaId, desde, hasta, q, abiertos } = query ?? {};
  const descripcion = { desde, hasta };

  let idempresa;
  let idtransportista = null;
  if (usuario.rol === 'empresa') {
    idempresa = usuario.id;
  } else if (usuario.rol === 'transportista') {
    // Un transportista solo ve lo suyo, mande lo que mande en el query.
    idempresa = usuario.idempresa;
    idtransportista = usuario.id;
  } else {
    throw new ErrorPublico('Sin permiso', 403);
  }

  // Solo la empresa puede filtrar por transportista.
  if (usuario.rol === 'empresa' && transportistaId) {
    const transportista = await resolver(supabase, 'usuario', transportistaId, usuario.id);
    if (!transportista) throw new ErrorPublico('Transportista no encontrado', 404);
    idtransportista = transportista.id;
    descripcion.transportista = transportista.nombre;
  }

  let idseller = null;
  if (sellerId) {
    const seller = await resolver(supabase, 'seller', sellerId, idempresa);
    if (!seller) throw new ErrorPublico('Seller no encontrado', 404);
    idseller = seller.id;
    descripcion.seller = seller.nombre;
  }

  // paquete.estado es canónico en la base (CHECK de
  // migration-estado-paquete.sql), así que se filtra por igualdad en SQL.
  let estadoCanonico = null;
  if (estado) {
    estadoCanonico = canonizarEstado(estado);
    if (!estadoCanonico) throw new ErrorPublico(`Estado inválido: "${estado}"`);
    descripcion.estado = estadoCanonico;
  }

  for (const [campo, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (valor && !FECHA_RE.test(valor)) throw new ErrorPublico(`"${campo}" tiene que ser YYYY-MM-DD`);
  }
  // El hasta se extiende al final del día para que el rango sea inclusivo.
  const desdeTs = desde ? `${desde}T00:00:00.000Z` : null;
  const hastaTs = hasta ? `${hasta}T23:59:59.999Z` : null;

  const texto = limpiarBusqueda(q);
  const soloAbiertos = Boolean(abiertos) && !estadoCanonico;

  const aplicar = (qb) => {
    let r = idempresa != null ? qb.eq('idempresa', idempresa) : qb;
    if (idtransportista != null) r = r.eq('idtransportista', idtransportista);
    if (idseller != null) r = r.eq('idseller', idseller);
    if (estadoCanonico) r = r.eq('estado', estadoCanonico);
    else if (soloAbiertos) r = r.in('estado', ABIERTOS);
    if (desdeTs) r = r.gte('fechaingreso', desdeTs);
    if (hastaTs) r = r.lte('fechaingreso', hastaTs);
    if (texto) {
      const patron = `"*${texto}*"`;
      r = r.or(`idenvioml.ilike.${patron},comprador.ilike.${patron},direccion.ilike.${patron}`);
    }
    return r;
  };

  const argsRpc = {
    p_idempresa: idempresa,
    p_idseller: idseller,
    p_idtransportista: idtransportista,
    p_estado: estadoCanonico,
    p_desde: desdeTs,
    p_hasta: hastaTs,
  };

  const hayFiltros = Boolean(idseller || transportistaId || estadoCanonico || soloAbiertos || desde || hasta || texto);

  return { aplicar, argsRpc, descripcion, idempresa, hayFiltros };
}

// Paquetes crudos → forma pública. Allowlist explícita: los ids internos (id,
// idempresa, idseller, idtransportista, idzona) no salen del servidor; afuera
// solo viajan nombres y public_id.
async function aPublicos(supabase, paquetes) {
  const ids = (campo) => paquetes.map((p) => p[campo]);
  // zona/área/seller/transportista se resuelven aparte: esas columnas no
  // tienen FK declarada en Supabase, así que un select embebido fallaría.
  const [zonas, areas, sellers, transportistas] = await Promise.all([
    buscarPorIds(supabase, 'zona', 'id, nombre', ids('idzona')),
    buscarPorIds(supabase, 'area_flex', 'id, nombre', ids('idarea')),
    buscarPorIds(supabase, 'seller', 'id, public_id, nombre', ids('idseller')),
    buscarPorIds(supabase, 'usuario', 'id, public_id, nombre', ids('idtransportista')),
  ]);

  return paquetes.map((p) => ({
    // N-02: el id SERIAL no sale; el cliente usa el public_id (UUID).
    id: p.public_id,
    idenvioml: p.idenvioml,
    comprador: p.comprador,
    direccion: p.direccion,
    codigopostal: p.codigopostal,
    fechaingreso: p.fechaingreso,
    fechaentrega: p.fechaentrega,
    // Se canoniza igual por si queda algún dato viejo sin normalizar.
    estado: canonizarEstado(p.estado) ?? p.estado,
    zona: zonas.get(p.idzona)?.nombre ?? null,
    // El partido/barrio que trajo Flex ("Belgrano", "Villa Soldati"). Es lo
    // que se lista: la zona es una agrupación interna que además cambia
    // según la lista con la que se mire el paquete.
    partido: areas.get(p.idarea)?.nombre ?? null,
    seller: sellers.get(p.idseller)?.nombre ?? null,
    sellerId: sellers.get(p.idseller)?.public_id ?? null,
    transportista: transportistas.get(p.idtransportista)?.nombre ?? null,
    transportistaId: transportistas.get(p.idtransportista)?.public_id ?? null,
  }));
}

// Conteos por (barrio, estado) desde Postgres, con el nombre del partido.
async function conteosPorPartido(supabase, argsRpc) {
  const filas = await traerTodo(() => supabase.rpc('estadisticas_paquetes', argsRpc));
  const areas = await buscarPorIds(
    supabase,
    'area_flex',
    'id, nombre',
    filas.map((f) => (f.idarea == null ? null : Number(f.idarea))),
  );
  return filas.map((f) => ({
    partido: f.idarea == null ? null : areas.get(Number(f.idarea))?.nombre ?? null,
    estado: f.estado,
    cantidad: Number(f.cantidad),
  }));
}

async function listado(supabase, req, res, filtros) {
  const query = req.query ?? {};
  const pagina = entero(query.pagina, 1, 1, 1_000_000);
  const limite = entero(query.limite, LIMITE_POR_DEFECTO, 1, LIMITE_MAXIMO);
  const orden = ORDENABLES.has(query.orden) ? query.orden : 'fechaingreso';
  const ascendente = query.dir === 'asc';
  const inicio = (pagina - 1) * limite;

  // Con filtros el total exacto es barato (usa los índices de
  // migration-escala.sql); sin filtros, sobre toda la tabla de la empresa,
  // alcanza con la estimación del planificador.
  const count = filtros.hayFiltros ? 'exact' : 'estimated';

  const { data, error, count: total } = await filtros
    .aplicar(supabase.from('paquete').select(COLUMNAS_PAQUETE, { count }))
    .order(orden, { ascending: ascendente, nullsFirst: false })
    // Desempate estable: sin esto, paquetes con la misma fecha pueden saltar
    // de una página a otra entre requests.
    .order('id', { ascending: ascendente })
    .range(inicio, inicio + limite - 1);
  if (error) throw new Error(error.message);

  const paquetes = await aPublicos(supabase, data ?? []);
  return res.json({ paquetes, total: total ?? paquetes.length, pagina, limite, origen: 'supabase' });
}

async function resumen(supabase, res, filtros) {
  const porEstado = Object.fromEntries(ESTADOS_VALIDOS.map((e) => [e, 0]));
  let total = 0;
  if (filtros.idempresa != null) {
    const filas = await traerTodo(() => supabase.rpc('estadisticas_paquetes', filtros.argsRpc));
    for (const f of filas) {
      const n = Number(f.cantidad) || 0;
      total += n;
      const estado = canonizarEstado(f.estado);
      if (estado) porEstado[estado] += n;
    }
  }
  return res.json({ total, porEstado });
}

async function estadisticas(supabase, res, filtros) {
  if (filtros.idempresa == null) return res.json({ filas: [], totales: { total: 0 } });
  return res.json(agruparConteos(await conteosPorPartido(supabase, filtros.argsRpc)));
}

async function excel(supabase, res, filtros) {
  const [conteos, detalle] = await Promise.all([
    conteosPorPartido(supabase, filtros.argsRpc),
    traerTodo(
      () =>
        filtros
          .aplicar(supabase.from('paquete').select(COLUMNAS_PAQUETE))
          .order('fechaingreso', { ascending: false })
          .order('id', { ascending: false }),
      { maximo: MAX_DETALLE_XLSX },
    ),
  ]);
  const paquetes = await aPublicos(supabase, detalle.filas);
  return responderEstadisticas(res, agruparConteos(conteos), paquetes, filtros.descripcion, detalle.truncado);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

  try {
    const supabase = getSupabase();
    if (req.query?.historial) return await historial(supabase, usuario, req.query.historial, res);

    const filtros = await prepararFiltros(supabase, usuario, req.query);

    if (req.query?.formato === 'xlsx') return await excel(supabase, res, filtros);
    if (req.query?.vista === 'resumen') return await resumen(supabase, res, filtros);
    if (req.query?.vista === 'estadisticas') return await estadisticas(supabase, res, filtros);
    return await listado(supabase, req, res, filtros);
  } catch (err) {
    return responderError(res, err, 500, '/api/paquetes');
  }
}
