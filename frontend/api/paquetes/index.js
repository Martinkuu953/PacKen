import { getSupabase } from '../_lib/ml.js';
import { autenticar } from '../_lib/auth.js';
import { canonizarEstado } from '../../shared/estados.js';
import { responderError } from '../_lib/errores.js';
import { esUuid } from '../_lib/paquetes/comun.js';
import { generarXlsx, ESTILOS_XLSX } from '../_lib/xlsx.js';
import { formatearFecha, responderArchivo } from '../_lib/emision.js';
import { agruparPorPartido, COLUMNAS_ESTADO } from '../../shared/estadisticas.js';

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

  const usuarios = await buscarPor(
    supabase,
    'usuario',
    'id, nombre',
    [...new Set((data ?? []).map((h) => h.idusuario).filter(Boolean))],
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

const ANCHOS_PARTIDO = [30, 10, ...COLUMNAS_ESTADO.map(() => 14), 12];
const ANCHOS_DETALLE = [18, 26, 14, 38, 14, 22, 22, 16, 16];

// GET /api/paquetes?...&formato=xlsx — las estadísticas por partido de los
// paquetes filtrados, igual que la tabla de la pantalla, más una hoja con el
// detalle de cada paquete.
function responderEstadisticas(res, paquetes, filtros) {
  const { filas, totales } = agruparPorPartido(paquetes);
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
      encabezado(['Partido', 'Total', ...COLUMNAS_ESTADO.map((c) => c.label), 'Demorados']),
      ...filas.map((f) => [
        f.partido,
        f.total,
        ...COLUMNAS_ESTADO.map((c) => f[c.estado] ?? 0),
        f.demorados,
      ]),
      [],
      [
        negrita('Total'),
        negrita(totales.total),
        ...COLUMNAS_ESTADO.map((c) => negrita(totales[c.estado] ?? 0)),
        negrita(totales.demorados),
      ],
    ],
  };

  const detalle = {
    nombre: 'Detalle',
    columnas: ANCHOS_DETALLE,
    filas: [
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

// GET /api/paquetes?estado=&sellerId=&transportistaId=&desde=&hasta=[&formato=xlsx]
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

  try {
    const supabase = getSupabase();
    if (req.query?.historial) return await historial(supabase, usuario, req.query.historial, res);

    const { estado, sellerId, transportistaId, desde, hasta, formato } = req.query ?? {};
    const filtros = { desde, hasta };

    let query = supabase.from('paquete').select('*').order('fechaingreso', { ascending: false });

    if (usuario.rol === 'transportista') {
      query = query.eq('idtransportista', usuario.id);
    } else if (usuario.rol === 'empresa') {
      // Aislamiento multi-tenant: una empresa solo ve sus propios paquetes.
      query = query.eq('idempresa', usuario.id);

      // Solo la empresa puede filtrar por transportista: para un transportista
      // el filtro por sí mismo ya está aplicado arriba.
      if (transportistaId) {
        const transportista = await resolver(supabase, 'usuario', transportistaId, usuario.id);
        if (!transportista) return res.status(404).json({ error: 'Transportista no encontrado' });
        query = query.eq('idtransportista', transportista.id);
        filtros.transportista = transportista.nombre;
      }
    }

    if (sellerId) {
      const idempresa = usuario.rol === 'empresa' ? usuario.id : null;
      const seller = await resolver(supabase, 'seller', sellerId, idempresa);
      if (!seller) return res.status(404).json({ error: 'Seller no encontrado' });
      query = query.eq('idseller', seller.id);
      filtros.seller = seller.nombre;
    }

    let estadoCanonico = null;
    if (estado) {
      estadoCanonico = canonizarEstado(estado);
      if (!estadoCanonico) {
        return res.status(400).json({ error: `Estado inválido: "${estado}"` });
      }
      filtros.estado = estadoCanonico;
    }

    // desde/hasta llegan como YYYY-MM-DD. El hasta se extiende al final del día
    // para que el rango sea inclusivo y no deje afuera lo cargado esa fecha.
    if (desde) query = query.gte('fechaingreso', `${desde}T00:00:00.000Z`);
    if (hasta) query = query.lte('fechaingreso', `${hasta}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // El estado se filtra en memoria, no con un .eq() en SQL: en la base
    // conviven grafías distintas del mismo estado ("EN CAMINO", "en_camino")
    // y una comparación exacta las dejaba afuera del listado.
    const paquetes = estadoCanonico
      ? (data ?? []).filter((p) => canonizarEstado(p.estado) === estadoCanonico)
      : (data ?? []);
    const unicos = (campo) => [...new Set(paquetes.map((p) => p[campo]).filter(Boolean))];

    // zona/área/seller/transportista se resuelven aparte: esas columnas no
    // tienen FK declarada en Supabase, así que un select embebido fallaría.
    const [zonas, areas, sellers, transportistas] = await Promise.all([
      buscarPor(supabase, 'zona', 'id, nombre', unicos('idzona')),
      buscarPor(supabase, 'area_flex', 'id, nombre', unicos('idarea')),
      buscarPor(supabase, 'seller', 'id, public_id, nombre', unicos('idseller')),
      buscarPor(supabase, 'usuario', 'id, public_id, nombre', unicos('idtransportista')),
    ]);

    // Allowlist explícita: los ids internos (id, idempresa, idseller,
    // idtransportista, idzona) no salen del servidor, igual que en el resto
    // de los endpoints. Afuera solo viajan nombres y public_id.
    const publicos = paquetes.map((p) => ({
      // N-02: el id SERIAL no sale; el cliente usa el public_id (UUID).
      id: p.public_id,
      idenvioml: p.idenvioml,
      comprador: p.comprador,
      direccion: p.direccion,
      codigopostal: p.codigopostal,
      fechaingreso: p.fechaingreso,
      fechaentrega: p.fechaentrega,
      // El estado se canoniza al leer: los paquetes migrados desde otra base
      // traen grafías distintas ("EN CAMINO", "en_camino") que la UI
      // clasificaba como desconocidas y dejaba fuera de los listados.
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

    if (formato === 'xlsx') return responderEstadisticas(res, publicos, filtros);

    return res.json({ paquetes: publicos, origen: 'supabase' });
  } catch (err) {
    return responderError(res, err, 500, '/api/paquetes');
  }
}

async function buscarPor(supabase, tabla, campos, ids) {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from(tabla).select(campos).in('id', ids);
  return new Map((data ?? []).map((fila) => [fila.id, fila]));
}
