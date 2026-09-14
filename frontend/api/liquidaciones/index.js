import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';
import { ErrorPublico, responderError } from '../_lib/errores.js';
import { canonizarEstado, ESTADOS } from '../../shared/estados.js';
import { generarXlsx, ESTILOS_XLSX } from '../_lib/xlsx.js';

// /api/liquidaciones — lo que la empresa le paga a cada transportista por los
// paquetes que entregó en un período.
//
//   GET                             → { transportistas, historial }  (panel)
//   GET  ?ids=<uuid,uuid>           → el .xlsx de esas liquidaciones
//   GET  ?ids=<uuid>&formato=json   → su detalle, para la vista previa
//   POST { transportistaIds, desde, hasta } → las crea y devuelve la vista previa
//
// El importe de cada paquete sale de la lista de COSTOS del transportista
// (usuario.idlista_costo) cruzada con la zona del paquete. Un transportista sin
// lista asignada no se puede liquidar: no habría con qué calcular.
//
// Requiere migration-liquidaciones.sql.

const HISTORIAL_MAX = 5;

// Una liquidación es plata: el día de entrega tiene que ser el que vio el
// administrador, no el que da UTC. Un paquete entregado 21:30 del 31 en
// Argentina es 00:30 del 1 en UTC, y con límites UTC se iba al período
// siguiente. Argentina no tiene horario de verano, así que el offset es fijo.
const OFFSET_AR = '-03:00';
const ZONA_AR = 'America/Argentina/Buenos_Aires';

function validarFecha(valor, campo) {
  const texto = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(Date.parse(texto))) {
    throw new ErrorPublico(`${campo} tiene que ser una fecha válida (YYYY-MM-DD)`);
  }
  return texto;
}

async function buscarPor(supabase, tabla, campos, ids) {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from(tabla).select(campos).in('id', ids);
  return new Map((data ?? []).map((fila) => [fila.id, fila]));
}

// PostgREST corta toda respuesta en max_rows (1000 por defecto en Supabase).
// Un mes de entregas lo pasa sin problema, y truncar en silencio acá significa
// pagarle de menos al transportista: por eso se pide página por página hasta
// que una venga incompleta. `construir` devuelve la query de nuevo en cada
// vuelta porque el builder de supabase-js se consume al ejecutarlo.
const PAGINA = 1000;

async function traerTodo(construir) {
  const filas = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await construir().range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return filas;
  }
}

const redondear = (n) => Math.round(n * 100) / 100;

// ──────────────────────────────────────────────────────────────────────────
// GET — panel (transportistas liquidables + historial)
// ──────────────────────────────────────────────────────────────────────────
async function panel(supabase, idempresa, res) {
  const { data: filas, error } = await supabase
    .from('usuario')
    .select('public_id, nombre, idlista_costo')
    .eq('idempresa', idempresa)
    .eq('rol', 'transportista')
    .eq('estado_solicitud', 'aceptado')
    .order('nombre');
  if (error) throw new Error(error.message);

  const idsListas = [...new Set((filas ?? []).map((t) => t.idlista_costo).filter(Boolean))];
  const listas = await buscarPor(supabase, 'lista', 'id, nombre', idsListas);

  const transportistas = (filas ?? []).map((t) => ({
    id: t.public_id,
    nombre: t.nombre,
    // null = no tiene lista de costos → la UI lo deshabilita.
    lista: t.idlista_costo ? listas.get(t.idlista_costo)?.nombre ?? null : null,
  }));

  const { data: hist, error: errHist } = await supabase
    .from('liquidacion')
    .select('public_id, transportista, desde, hasta, cantidad, total, created_at')
    .eq('idempresa', idempresa)
    .order('created_at', { ascending: false })
    .limit(HISTORIAL_MAX);
  if (errHist) throw new Error(errHist.message);

  const historial = (hist ?? []).map((l) => ({
    id: l.public_id,
    transportista: l.transportista,
    desde: l.desde,
    hasta: l.hasta,
    cantidad: l.cantidad,
    total: Number(l.total),
    creadaEn: l.created_at,
  }));

  return res.json({ transportistas, historial });
}

// ──────────────────────────────────────────────────────────────────────────
// POST — crear
// ──────────────────────────────────────────────────────────────────────────
async function crear(supabase, idempresa, req, res) {
  const { transportistaIds, desde: desdeRaw, hasta: hastaRaw } = req.body ?? {};

  if (!Array.isArray(transportistaIds) || transportistaIds.length === 0) {
    throw new ErrorPublico('Elegí al menos un transportista');
  }

  const desde = validarFecha(desdeRaw, 'La fecha "desde"');
  const hasta = validarFecha(hastaRaw, 'La fecha "hasta"');
  if (desde > hasta) throw new ErrorPublico('La fecha "desde" no puede ser posterior a la fecha "hasta"');

  const ids = [...new Set(transportistaIds.map(String))];

  const { data: filas, error } = await supabase
    .from('usuario')
    .select('id, public_id, nombre, idlista_costo')
    .eq('idempresa', idempresa)
    .eq('rol', 'transportista')
    .in('public_id', ids);
  if (error) throw new Error(error.message);

  if ((filas ?? []).length !== ids.length) {
    throw new ErrorPublico('Alguno de los transportistas elegidos no existe', 404);
  }

  const sinLista = filas.filter((t) => !t.idlista_costo).map((t) => t.nombre);
  if (sinLista.length) {
    throw new ErrorPublico(
      `Sin lista de costos asignada: ${sinLista.join(', ')}. Asignales una en "Listas de precios/costos".`,
    );
  }

  // Tarifa por (lista, zona): es el precio unitario de cada paquete.
  const idsListas = [...new Set(filas.map((t) => t.idlista_costo))];
  const { data: tarifasRows, error: errTarifas } = await supabase
    .from('lista_zona_tarifa')
    .select('idlista, idzona, importe')
    .in('idlista', idsListas);
  if (errTarifas) throw new Error(errTarifas.message);

  const tarifas = new Map((tarifasRows ?? []).map((t) => [`${t.idlista}:${t.idzona}`, Number(t.importe)]));

  // desde/hasta llegan como YYYY-MM-DD; el hasta se extiende al final del día
  // para que el rango sea inclusivo.
  const paquetes = await traerTodo(() =>
    supabase
      .from('paquete')
      .select('id, idenvioml, direccion, fechaentrega, estado, idzona, idseller, idtransportista')
      .eq('idempresa', idempresa)
      .in('idtransportista', filas.map((t) => t.id))
      .gte('fechaentrega', `${desde}T00:00:00.000${OFFSET_AR}`)
      .lte('fechaentrega', `${hasta}T23:59:59.999${OFFSET_AR}`)
      .order('fechaentrega')
      .order('id'),
  );

  // El estado se filtra en memoria y no con un .eq(): en la base conviven
  // grafías distintas del mismo estado ("ENTREGADO", "entregado"), igual que
  // en /api/paquetes.
  const entregados = paquetes.filter((p) => canonizarEstado(p.estado) === ESTADOS.ENTREGADO);

  const unicos = (campo) => [...new Set(entregados.map((p) => p[campo]).filter(Boolean))];
  const [zonas, sellers] = await Promise.all([
    buscarPor(supabase, 'zona', 'id, nombre', unicos('idzona')),
    buscarPor(supabase, 'seller', 'id, nombre', unicos('idseller')),
  ]);

  const liquidaciones = [];
  const sinPaquetes = [];

  for (const transportista of filas) {
    const propios = entregados.filter((p) => p.idtransportista === transportista.id);
    if (propios.length === 0) {
      sinPaquetes.push(transportista.nombre);
      continue;
    }

    const lineas = propios.map((p) => ({
      idenvioml: p.idenvioml ?? null,
      direccion: p.direccion ?? null,
      fechaentrega: p.fechaentrega,
      seller: sellers.get(p.idseller)?.nombre ?? null,
      zona: zonas.get(p.idzona)?.nombre ?? null,
      // Sin tarifa cargada para esa zona el paquete vale 0 y queda visible en
      // la planilla, que es más útil que abortar toda la liquidación.
      importe: tarifas.get(`${transportista.idlista_costo}:${p.idzona}`) ?? 0,
    }));

    const total = redondear(lineas.reduce((suma, l) => suma + l.importe, 0));

    const { data: cabecera, error: errIns } = await supabase
      .from('liquidacion')
      .insert({
        idempresa,
        idtransportista: transportista.id,
        transportista: transportista.nombre,
        desde,
        hasta,
        cantidad: lineas.length,
        total,
      })
      .select('id, public_id, created_at')
      .single();
    if (errIns) throw new Error(errIns.message);

    // lineas y propios están alineadas por índice: salen del mismo map.
    const { error: errDet } = await supabase
      .from('liquidacion_detalle')
      .insert(lineas.map((l, i) => ({ idliquidacion: cabecera.id, idpaquete: propios[i].id, ...l })));
    if (errDet) throw new Error(errDet.message);

    liquidaciones.push({
      id: cabecera.public_id,
      transportista: transportista.nombre,
      desde,
      hasta,
      cantidad: lineas.length,
      total,
      creadaEn: cabecera.created_at,
      lineas,
    });
  }

  if (liquidaciones.length === 0) {
    throw new ErrorPublico(
      `No hay paquetes entregados entre ${desde} y ${hasta} para ${sinPaquetes.join(', ')}.`,
    );
  }

  return res.status(201).json({ liquidaciones, sinPaquetes });
}

// ──────────────────────────────────────────────────────────────────────────
// GET ?ids= — una liquidación ya emitida, en JSON (vista previa) o .xlsx
// ──────────────────────────────────────────────────────────────────────────
const ENCABEZADOS = ['Dirección', 'Fecha de entrega', 'Seller', 'Zona', 'Envío ML', 'Precio'];
const ANCHOS = [38, 16, 24, 14, 18, 14];

const formatearFecha = (valor) => {
  if (!valor) return '—';
  // desde/hasta son DATE (YYYY-MM-DD, sin hora): convertirlos con zona horaria
  // los correría un día. Se muestran tal cual vinieron.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? '—'
    : fecha.toLocaleDateString('es-AR', { timeZone: ZONA_AR });
};

// Relee liquidaciones ya emitidas con su detalle. Lo comparten la vista previa
// (JSON) y la descarga (.xlsx), para que las dos muestren exactamente lo mismo.
async function traerLiquidaciones(supabase, idempresa, idsCrudos) {
  const ids = String(idsCrudos ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) throw new ErrorPublico('ids es requerido');

  const { data: cabeceras, error } = await supabase
    .from('liquidacion')
    .select('id, public_id, transportista, desde, hasta, cantidad, total, created_at')
    .eq('idempresa', idempresa)
    .in('public_id', ids)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!cabeceras?.length) throw new ErrorPublico('Liquidación no encontrada', 404);

  const detalles = await traerTodo(() =>
    supabase
      .from('liquidacion_detalle')
      .select('idliquidacion, direccion, fechaentrega, seller, zona, idenvioml, importe')
      .in('idliquidacion', cabeceras.map((c) => c.id))
      .order('fechaentrega')
      .order('id'),
  );

  const porLiquidacion = new Map(cabeceras.map((c) => [c.id, []]));
  for (const d of detalles) porLiquidacion.get(d.idliquidacion)?.push(d);

  return cabeceras.map((c) => ({
    id: c.public_id,
    transportista: c.transportista,
    desde: c.desde,
    hasta: c.hasta,
    cantidad: c.cantidad,
    total: Number(c.total),
    creadaEn: c.created_at,
    // numeric de Postgres llega como string: sin el Number() la vista previa
    // sumaría concatenando.
    lineas: (porLiquidacion.get(c.id) ?? []).map((l) => ({
      idenvioml: l.idenvioml,
      direccion: l.direccion,
      fechaentrega: l.fechaentrega,
      seller: l.seller,
      zona: l.zona,
      importe: Number(l.importe),
    })),
  }));
}

async function detallar(supabase, idempresa, req, res) {
  const liquidaciones = await traerLiquidaciones(supabase, idempresa, req.query.ids);
  return res.json({ liquidaciones });
}

async function descargar(supabase, idempresa, req, res) {
  const liquidaciones = await traerLiquidaciones(supabase, idempresa, req.query.ids);

  const hojas = liquidaciones.map((c) => {
    const filas = [
      [{ v: c.transportista, s: ESTILOS_XLSX.negrita }],
      [`Período: ${formatearFecha(c.desde)} al ${formatearFecha(c.hasta)}`],
      [],
      ENCABEZADOS.map((titulo) => ({ v: titulo, s: ESTILOS_XLSX.encabezado })),
      ...c.lineas.map((l) => [
        l.direccion ?? '—',
        formatearFecha(l.fechaentrega),
        l.seller ?? '—',
        l.zona ?? '—',
        l.idenvioml ?? '—',
        { v: l.importe, s: ESTILOS_XLSX.moneda },
      ]),
      [],
      [
        { v: `Total (${c.cantidad} paquete${c.cantidad === 1 ? '' : 's'})`, s: ESTILOS_XLSX.negrita },
        '',
        '',
        '',
        '',
        { v: c.total, s: ESTILOS_XLSX.monedaNegrita },
      ],
    ];
    return { nombre: c.transportista, columnas: ANCHOS, filas };
  });

  const archivo = generarXlsx(hojas);
  const nombre =
    liquidaciones.length === 1
      ? `liquidacion-${liquidaciones[0].transportista}-${liquidaciones[0].desde}_${liquidaciones[0].hasta}.xlsx`
      : `liquidaciones-${liquidaciones[0].desde}_${liquidaciones[0].hasta}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // El nombre del transportista puede traer acentos: filename* (RFC 5987) es
  // el que los soporta; filename queda como respaldo en ASCII.
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="liquidacion.xlsx"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
  );
  res.setHeader('Content-Length', archivo.length);
  return res.status(200).end(archivo);
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();
    if (req.method === 'POST') return await crear(supabase, usuario.id, req, res);
    if (req.query?.ids) {
      return req.query.formato === 'json'
        ? await detallar(supabase, usuario.id, req, res)
        : await descargar(supabase, usuario.id, req, res);
    }
    return await panel(supabase, usuario.id, res);
  } catch (err) {
    return responderError(res, err, 500, '/api/liquidaciones');
  }
}
