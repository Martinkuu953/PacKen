import { getSupabase } from './ml.js';
import { autenticar, requiereRol } from './auth.js';
import { ErrorPublico, responderError } from './errores.js';
import { canonizarEstado, ESTADOS } from '../../shared/estados.js';
import { generarXlsx, generarZip, ESTILOS_XLSX } from './xlsx.js';
import { cargarResolutorZonas } from './zonas.js';

// Motor común de liquidaciones y facturas.
//
// Las dos son el mismo documento mirado desde puntas opuestas: se eligen unas
// contrapartes y un rango de fechas, se toman los paquetes ENTREGADOS del
// período y se valoriza cada uno con la lista de esa contraparte cruzada con la
// zona del paquete.
//
//   liquidación → se le PAGA al transportista con su lista de COSTOS
//   factura     → se le COBRA al seller con su lista de PRECIOS
//
// La diferencia entre las dos por un mismo paquete es lo que gana la empresa.
// Todo lo que cambia entre una y otra está en el objeto `tipo` que recibe cada
// función (ver TIPOS abajo): tablas, nombres de columna y vocabulario.

// Últimas N por contraparte, no N sobre el total de la empresa: con varios,
// las últimas 5 de toda la empresa podían ser todas de la misma.
const HISTORIAL_MAX = 5;

// El día de entrega tiene que ser el que vio el administrador, no el que da
// UTC. Un paquete entregado 21:30 del 31 en Argentina es 00:30 del 1 en UTC, y
// con límites UTC se iba al período siguiente. Argentina no tiene horario de
// verano, así que el offset es fijo.
const OFFSET_AR = '-03:00';
const ZONA_AR = 'America/Argentina/Buenos_Aires';

// ──────────────────────────────────────────────────────────────────────────
// Configuración de cada tipo de documento
// ──────────────────────────────────────────────────────────────────────────
//
//   tabla / tablaDetalle : dónde se guarda
//   fkDetalle            : columna de la cabecera en el detalle
//   idContraparte        : columna de la cabecera que apunta a quién se emite
//   nombreContraparte    : columna donde va congelado su nombre
//   campoPaquete         : por qué columna del paquete se filtra
//   columnaSecundaria    : la otra punta del paquete, congelada en el detalle
//   cargarContrapartes   : las que se pueden emitir, con su lista asignada
//
export const TIPOS = {
  liquidacion: {
    clave: 'liquidacion',
    tabla: 'liquidacion',
    tablaDetalle: 'liquidacion_detalle',
    fkDetalle: 'idliquidacion',
    idContraparte: 'idtransportista',
    nombreContraparte: 'transportista',
    campoPaquete: 'idtransportista',
    columnaSecundaria: { campo: 'seller', tabla: 'seller', desde: 'idseller', titulo: 'Seller' },
    etiquetas: {
      documento: 'liquidación',
      documentos: 'liquidaciones',
      contraparte: 'transportista',
      contrapartes: 'transportistas',
      archivo: 'liquidacion',
      archivos: 'liquidaciones',
      noEncontrado: 'Liquidación no encontrada',
      sinLista: 'Sin lista de costos asignada',
      dondeAsignar: 'Asignales una en "Listas de precios/costos".',
    },
    async cargarContrapartes(supabase, idempresa) {
      const { data, error } = await supabase
        .from('usuario')
        .select('id, public_id, nombre, idlista_costo')
        .eq('idempresa', idempresa)
        .eq('rol', 'transportista')
        .eq('estado_solicitud', 'aceptado')
        .order('nombre');
      if (error) throw new Error(error.message);
      return (data ?? []).map((t) => ({
        id: t.id,
        public_id: t.public_id,
        nombre: t.nombre,
        idlista: t.idlista_costo,
      }));
    },
  },

  factura: {
    clave: 'factura',
    tabla: 'factura',
    tablaDetalle: 'factura_detalle',
    fkDetalle: 'idfactura',
    idContraparte: 'idseller',
    nombreContraparte: 'seller',
    campoPaquete: 'idseller',
    columnaSecundaria: {
      campo: 'transportista',
      tabla: 'usuario',
      desde: 'idtransportista',
      titulo: 'Transportista',
    },
    etiquetas: {
      documento: 'factura',
      documentos: 'facturas',
      contraparte: 'seller',
      contrapartes: 'sellers',
      archivo: 'factura',
      archivos: 'facturas',
      noEncontrado: 'Factura no encontrada',
      sinLista: 'Sin lista de precios asignada',
      dondeAsignar: 'Asignales una en "Listas de precios/costos".',
    },
    // Un seller no se autorregistra (lo crea la empresa), así que no hay
    // estado_solicitud que filtrar: alcanza con que sea de esta empresa.
    async cargarContrapartes(supabase, idempresa) {
      const { data, error } = await supabase
        .from('seller')
        .select('id, public_id, nombre, idlista')
        .eq('idempresa', idempresa)
        .order('nombre');
      if (error) throw new Error(error.message);
      return (data ?? []).map((s) => ({
        id: s.id,
        public_id: s.public_id,
        nombre: s.nombre,
        idlista: s.idlista,
      }));
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Utilidades
// ──────────────────────────────────────────────────────────────────────────
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
// facturar de menos: por eso se pide página por página hasta que una venga
// incompleta. `construir` devuelve la query de nuevo en cada vuelta porque el
// builder de supabase-js se consume al ejecutarlo.
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

export const listaDeIds = (crudos) =>
  String(crudos ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// La cabecera sale a la calle siempre con la misma forma, llame como llame la
// columna adentro: así el frontend es uno solo para los dos documentos.
const salidaCabecera = (tipo, fila) => ({
  id: fila.public_id,
  contraparte: fila[tipo.nombreContraparte],
  desde: fila.desde,
  hasta: fila.hasta,
  cantidad: fila.cantidad,
  // numeric de Postgres llega como string: sin el Number() la vista previa
  // sumaría concatenando.
  total: Number(fila.total),
  creadaEn: fila.created_at,
});

// ──────────────────────────────────────────────────────────────────────────
// GET — panel (contrapartes emitibles + historial de las elegidas)
// ──────────────────────────────────────────────────────────────────────────

// Las últimas HISTORIAL_MAX de cada contraparte. Va una consulta por cada una y
// no una sola con .in(): un único .limit() sobre el conjunto se lo llevaría la
// que más emitió, dejando a las demás en cero.
async function historialDe(supabase, tipo, idempresa, contrapartes) {
  const columnas = `public_id, ${tipo.nombreContraparte}, desde, hasta, cantidad, total, created_at`;

  const resultados = await Promise.all(
    contrapartes.map((c) =>
      supabase
        .from(tipo.tabla)
        .select(columnas)
        .eq('idempresa', idempresa)
        .eq(tipo.idContraparte, c.id)
        .order('created_at', { ascending: false })
        .limit(HISTORIAL_MAX),
    ),
  );

  const filas = [];
  for (const { data, error } of resultados) {
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
  }

  // Ya mezcladas, se ordenan de nuevo: cada consulta vino ordenada por su
  // cuenta, y la lista se lee como una sola línea de tiempo.
  return filas
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((fila) => salidaCabecera(tipo, fila));
}

export async function panel(supabase, tipo, idempresa, req, res) {
  const filas = await tipo.cargarContrapartes(supabase, idempresa);

  const idsListas = [...new Set(filas.map((c) => c.idlista).filter(Boolean))];
  const listas = await buscarPor(supabase, 'lista', 'id, nombre', idsListas);

  const contrapartes = filas.map((c) => ({
    id: c.public_id,
    nombre: c.nombre,
    // null = no tiene lista asignada → la UI lo deshabilita.
    lista: c.idlista ? listas.get(c.idlista)?.nombre ?? null : null,
  }));

  // Sin contrapartes elegidas no hay historial que mostrar: primero se elige de
  // quién se quiere ver, y recién ahí se traen sus documentos.
  const elegidas = new Set(listaDeIds(req.query?.contraparteIds));
  const historial = elegidas.size
    ? await historialDe(supabase, tipo, idempresa, filas.filter((c) => elegidas.has(c.public_id)))
    : [];

  return res.json({ contrapartes, historial });
}

// ──────────────────────────────────────────────────────────────────────────
// POST — crear
// ──────────────────────────────────────────────────────────────────────────
export async function crear(supabase, tipo, idempresa, req, res) {
  const { contraparteIds, desde: desdeRaw, hasta: hastaRaw } = req.body ?? {};
  const { etiquetas } = tipo;

  if (!Array.isArray(contraparteIds) || contraparteIds.length === 0) {
    throw new ErrorPublico(`Elegí al menos un ${etiquetas.contraparte}`);
  }

  const desde = validarFecha(desdeRaw, 'La fecha "desde"');
  const hasta = validarFecha(hastaRaw, 'La fecha "hasta"');
  if (desde > hasta) {
    throw new ErrorPublico('La fecha "desde" no puede ser posterior a la fecha "hasta"');
  }

  const ids = [...new Set(contraparteIds.map(String))];
  const todas = await tipo.cargarContrapartes(supabase, idempresa);
  const filas = todas.filter((c) => ids.includes(c.public_id));

  if (filas.length !== ids.length) {
    throw new ErrorPublico(`Alguno de los ${etiquetas.contrapartes} elegidos no existe`, 404);
  }

  const sinLista = filas.filter((c) => !c.idlista).map((c) => c.nombre);
  if (sinLista.length) {
    throw new ErrorPublico(`${etiquetas.sinLista}: ${sinLista.join(', ')}. ${etiquetas.dondeAsignar}`);
  }

  // Tarifa por (lista, zona): es el precio unitario de cada paquete.
  const idsListas = [...new Set(filas.map((c) => c.idlista))];
  const { data: tarifasRows, error: errTarifas } = await supabase
    .from('lista_zona_tarifa')
    .select('idlista, idzona, importe')
    .in('idlista', idsListas);
  if (errTarifas) throw new Error(errTarifas.message);

  const tarifas = new Map(
    (tarifasRows ?? []).map((t) => [`${t.idlista}:${t.idzona}`, Number(t.importe)]),
  );

  // desde/hasta llegan como YYYY-MM-DD; el hasta se extiende al final del día
  // para que el rango sea inclusivo.
  const paquetes = await traerTodo(() =>
    supabase
      .from('paquete')
      .select('id, idenvioml, direccion, fechaentrega, estado, idarea, idzona, idseller, idtransportista')
      .eq('idempresa', idempresa)
      .in(tipo.campoPaquete, filas.map((c) => c.id))
      .gte('fechaentrega', `${desde}T00:00:00.000${OFFSET_AR}`)
      .lte('fechaentrega', `${hasta}T23:59:59.999${OFFSET_AR}`)
      .order('fechaentrega')
      .order('id'),
  );

  // El estado se filtra en memoria y no con un .eq(): en la base conviven
  // grafías distintas del mismo estado ("ENTREGADO", "entregado"), igual que
  // en /api/paquetes.
  const entregados = paquetes.filter((p) => canonizarEstado(p.estado) === ESTADOS.ENTREGADO);

  // La zona del paquete se resuelve contra la lista de la contraparte: el mismo
  // barrio puede caer en zonas distintas según la lista.
  const zonaDe = await cargarResolutorZonas(supabase, idempresa, idsListas);
  const zonaPorPaquete = new Map(
    entregados.map((p) => {
      const c = filas.find((f) => f.id === p[tipo.campoPaquete]);
      return [p.id, zonaDe(c?.idlista, p.idarea, p.idzona)];
    }),
  );

  const secundaria = tipo.columnaSecundaria;
  const unicos = (campo) => [...new Set(entregados.map((p) => p[campo]).filter(Boolean))];
  const [zonas, secundarios] = await Promise.all([
    buscarPor(supabase, 'zona', 'id, nombre', [
      ...new Set([...zonaPorPaquete.values()].filter(Boolean)),
    ]),
    buscarPor(supabase, secundaria.tabla, 'id, nombre', unicos(secundaria.desde)),
  ]);

  const documentos = [];
  const sinPaquetes = [];

  for (const contraparte of filas) {
    const propios = entregados.filter((p) => p[tipo.campoPaquete] === contraparte.id);
    if (propios.length === 0) {
      sinPaquetes.push(contraparte.nombre);
      continue;
    }

    // Las líneas se arman con el nombre de columna que tiene la tabla
    // ('seller' o 'transportista'); a la salida se renombra a `secundario`,
    // que es lo que el frontend consume para los dos documentos.
    const lineas = propios.map((p) => {
      const idzona = zonaPorPaquete.get(p.id);
      return {
        idenvioml: p.idenvioml ?? null,
        direccion: p.direccion ?? null,
        fechaentrega: p.fechaentrega,
        [secundaria.campo]: secundarios.get(p[secundaria.desde])?.nombre ?? null,
        zona: zonas.get(idzona)?.nombre ?? null,
        // Sin tarifa cargada para esa zona el paquete vale 0 y queda visible en
        // la planilla, que es más útil que abortar todo el documento.
        importe: tarifas.get(`${contraparte.idlista}:${idzona}`) ?? 0,
      };
    });

    const total = redondear(lineas.reduce((suma, l) => suma + l.importe, 0));

    const { data: cabecera, error: errIns } = await supabase
      .from(tipo.tabla)
      .insert({
        idempresa,
        [tipo.idContraparte]: contraparte.id,
        [tipo.nombreContraparte]: contraparte.nombre,
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
      .from(tipo.tablaDetalle)
      .insert(
        lineas.map((l, i) => ({ [tipo.fkDetalle]: cabecera.id, idpaquete: propios[i].id, ...l })),
      );
    if (errDet) throw new Error(errDet.message);

    documentos.push({
      id: cabecera.public_id,
      contraparte: contraparte.nombre,
      desde,
      hasta,
      cantidad: lineas.length,
      total,
      creadaEn: cabecera.created_at,
      lineas: lineas.map(({ [secundaria.campo]: secundario, ...resto }) => ({ ...resto, secundario })),
    });
  }

  if (documentos.length === 0) {
    throw new ErrorPublico(
      `No hay paquetes entregados entre ${desde} y ${hasta} para ${sinPaquetes.join(', ')}.`,
    );
  }

  return res.status(201).json({ documentos, sinPaquetes });
}

// ──────────────────────────────────────────────────────────────────────────
// GET ?ids= — documentos ya emitidos, en JSON (vista previa) o .xlsx / .zip
// ──────────────────────────────────────────────────────────────────────────
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

// Relee documentos ya emitidos con su detalle. Lo comparten la vista previa
// (JSON) y la descarga, para que las dos muestren exactamente lo mismo.
async function traerDocumentos(supabase, tipo, idempresa, idsCrudos) {
  const ids = listaDeIds(idsCrudos);
  if (ids.length === 0) throw new ErrorPublico('ids es requerido');

  const secundaria = tipo.columnaSecundaria;

  const { data: cabeceras, error } = await supabase
    .from(tipo.tabla)
    .select(`id, public_id, ${tipo.nombreContraparte}, desde, hasta, cantidad, total, created_at`)
    .eq('idempresa', idempresa)
    .in('public_id', ids)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  if (!cabeceras?.length) throw new ErrorPublico(tipo.etiquetas.noEncontrado, 404);

  const detalles = await traerTodo(() =>
    supabase
      .from(tipo.tablaDetalle)
      .select(
        `${tipo.fkDetalle}, direccion, fechaentrega, ${secundaria.campo}, zona, idenvioml, importe`,
      )
      .in(tipo.fkDetalle, cabeceras.map((c) => c.id))
      .order('fechaentrega')
      .order('id'),
  );

  const porDocumento = new Map(cabeceras.map((c) => [c.id, []]));
  for (const d of detalles) porDocumento.get(d[tipo.fkDetalle])?.push(d);

  return cabeceras.map((c) => ({
    ...salidaCabecera(tipo, c),
    lineas: (porDocumento.get(c.id) ?? []).map((l) => ({
      idenvioml: l.idenvioml,
      direccion: l.direccion,
      fechaentrega: l.fechaentrega,
      // `secundario` es el nombre estable que consume el frontend; el título de
      // la columna lo pone cada tipo.
      secundario: l[secundaria.campo],
      zona: l.zona,
      importe: Number(l.importe),
    })),
  }));
}

export async function detallar(supabase, tipo, idempresa, req, res) {
  const documentos = await traerDocumentos(supabase, tipo, idempresa, req.query.ids);
  return res.json({ documentos });
}

const ANCHOS = [38, 16, 24, 14, 18, 14];

// Una hoja por documento: el mismo contenido tanto si van todos juntos en un
// libro como si cada uno sale en su propio archivo.
function hojaDe(tipo, c) {
  const encabezados = [
    'Dirección',
    'Fecha de entrega',
    tipo.columnaSecundaria.titulo,
    'Zona',
    'Envío ML',
    'Precio',
  ];

  const filas = [
    [{ v: c.contraparte, s: ESTILOS_XLSX.negrita }],
    [`Período: ${formatearFecha(c.desde)} al ${formatearFecha(c.hasta)}`],
    [],
    encabezados.map((titulo) => ({ v: titulo, s: ESTILOS_XLSX.encabezado })),
    ...c.lineas.map((l) => [
      l.direccion ?? '—',
      formatearFecha(l.fechaentrega),
      l.secundario ?? '—',
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
  return { nombre: c.contraparte, columnas: ANCHOS, filas };
}

const nombreDocumento = (tipo, c) =>
  `${tipo.etiquetas.archivo}-${c.contraparte}-${c.desde}_${c.hasta}`;

// Los nombres van sin acentos ni espacios porque viajan dentro de un .zip, que
// no define codificación: un nombre "raro" lo descomprime mal más de un
// programa de Windows.
const limpiarNombre = (texto) =>
  String(texto)
    // NFD separa la tilde de la letra, y el rango de diacríticos la borra: sin
    // esto "Martín" terminaría como "Mart-n", porque la tilde suelta tampoco
    // pasa el filtro de abajo.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-.]+/g, '-');

function nombresUnicos(tipo, documentos) {
  const usados = new Set();
  return documentos.map((c) => {
    const base = limpiarNombre(nombreDocumento(tipo, c));
    // Dos documentos de la misma contraparte por el mismo período son legítimos
    // (se rehízo uno): sin desambiguar, el segundo pisaba al primero adentro
    // del .zip.
    let nombre = `${base}.xlsx`;
    let n = 2;
    while (usados.has(nombre)) nombre = `${base}-${n++}.xlsx`;
    usados.add(nombre);
    return nombre;
  });
}

function responderArchivo(res, archivo, nombre, contentType, respaldo) {
  res.setHeader('Content-Type', contentType);
  // El nombre de la contraparte puede traer acentos: filename* (RFC 5987) es
  // el que los soporta; filename queda como respaldo en ASCII.
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${respaldo}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
  );
  res.setHeader('Content-Length', archivo.length);
  return res.status(200).end(archivo);
}

export async function descargar(supabase, tipo, idempresa, req, res) {
  const documentos = await traerDocumentos(supabase, tipo, idempresa, req.query.ids);
  const { archivo: base, archivos } = tipo.etiquetas;

  // Separado: un .xlsx por documento, todos dentro de un .zip. Con uno solo el
  // .zip sería una carpeta con un archivo adentro, así que da igual el modo y
  // sale el .xlsx suelto.
  if (req.query.modo === 'separado' && documentos.length > 1) {
    const nombres = nombresUnicos(tipo, documentos);
    const zip = generarZip(
      documentos.map((c, i) => ({ nombre: nombres[i], contenido: generarXlsx([hojaDe(tipo, c)]) })),
    );
    const nombre = `${archivos}-${documentos[0].desde}_${documentos[0].hasta}.zip`;
    return responderArchivo(res, zip, nombre, 'application/zip', `${archivos}.zip`);
  }

  const xlsx = generarXlsx(documentos.map((c) => hojaDe(tipo, c)));
  const nombre =
    documentos.length === 1
      ? `${nombreDocumento(tipo, documentos[0])}.xlsx`
      : `${archivos}-${documentos[0].desde}_${documentos[0].hasta}.xlsx`;

  return responderArchivo(
    res,
    xlsx,
    nombre,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `${base}.xlsx`,
  );
}

// El handler es idéntico para los dos documentos: solo cambia el `tipo`.
export function crearHandler(tipo) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const usuario = await autenticar(req, res);
    if (!usuario) return;
    if (!requiereRol(res, usuario, 'empresa')) return;

    try {
      const supabase = getSupabase();
      if (req.method === 'POST') return await crear(supabase, tipo, usuario.id, req, res);
      if (req.query?.ids) {
        return req.query.formato === 'json'
          ? await detallar(supabase, tipo, usuario.id, req, res)
          : await descargar(supabase, tipo, usuario.id, req, res);
      }
      return await panel(supabase, tipo, usuario.id, req, res);
    } catch (err) {
      return responderError(res, err, 500, `/api/${tipo.etiquetas.documentos}`);
    }
  };
}
