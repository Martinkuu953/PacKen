import { getSupabase, obtenerAreasFlex } from './ml.js';
import { autenticar, requiereRol } from './auth.js';

// Lógica compartida por /api/precios (tipo 'precio', entidad = seller) y
// /api/costos (tipo 'costo', entidad = transportista). Vive en _lib para no
// gastar una Serverless Function extra (el plan Hobby de Vercel permite 12).
//
// Modelo (ver migration-listas-flex.sql):
//   lista               → lista con nombre, reutilizable (tipo precio|costo)
//   lista_zona_tarifa   → importe por (lista, zona)
//   zona                → zonas de la empresa (Zona 1/2/3)
//   area_flex           → barrios/municipios de Flex mapeados a una zona
//   seller.idlista / usuario.idlista_costo → lista de cada entidad
//
// Las zonas y las áreas son compartidas por precios y costos, así que solo el
// endpoint de precios (manejaZonas = true) las administra; costos las lee.

function parsearImporte(valor, campo, { permitirNegativo = false } = {}) {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
    throw new Error(`${campo} debe ser un número`);
  }
  if (!permitirNegativo && numero < 0) throw new Error(`${campo} no puede ser negativo`);
  return numero;
}

const ahora = () => new Date().toISOString();

// ──────────────────────────────────────────────────────────────────────────
// Entidades por tipo: sellers (precio) vs transportistas (costo)
// ──────────────────────────────────────────────────────────────────────────
const ENTIDADES = {
  precio: {
    async listar(supabase, idempresa) {
      const { data, error } = await supabase
        .from('seller')
        .select('id, public_id, nombre, idlista')
        .eq('idempresa', idempresa)
        .order('nombre');
      if (error) throw new Error(error.message);
      return (data ?? []).map((s) => ({ publicId: s.public_id, nombre: s.nombre, idlista: s.idlista }));
    },
    async buscar(supabase, idempresa, publicId) {
      const { data } = await supabase
        .from('seller')
        .select('id')
        .eq('public_id', publicId)
        .eq('idempresa', idempresa)
        .maybeSingle();
      return data?.id ?? null;
    },
    async asignar(supabase, entidadInternalId, listaInternalId) {
      const { error } = await supabase
        .from('seller')
        .update({ idlista: listaInternalId })
        .eq('id', entidadInternalId);
      if (error) throw new Error(error.message);
    },
  },
  costo: {
    async listar(supabase, idempresa) {
      const { data, error } = await supabase
        .from('usuario')
        .select('id, public_id, nombre, idlista_costo')
        .eq('idempresa', idempresa)
        .eq('rol', 'transportista')
        .eq('estado_solicitud', 'aceptado')
        .order('nombre');
      if (error) throw new Error(error.message);
      return (data ?? []).map((t) => ({ publicId: t.public_id, nombre: t.nombre, idlista: t.idlista_costo }));
    },
    async buscar(supabase, idempresa, publicId) {
      const { data } = await supabase
        .from('usuario')
        .select('id')
        .eq('public_id', publicId)
        .eq('idempresa', idempresa)
        .eq('rol', 'transportista')
        .maybeSingle();
      return data?.id ?? null;
    },
    async asignar(supabase, entidadInternalId, listaInternalId) {
      const { error } = await supabase
        .from('usuario')
        .update({ idlista_costo: listaInternalId })
        .eq('id', entidadInternalId);
      if (error) throw new Error(error.message);
    },
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Resolución de public_id → id interno (siempre acotada a la empresa)
// ──────────────────────────────────────────────────────────────────────────
async function resolverLista(supabase, idempresa, tipo, publicId) {
  if (!publicId) return null;
  const { data } = await supabase
    .from('lista')
    .select('id')
    .eq('public_id', publicId)
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolverZona(supabase, idempresa, publicId) {
  if (!publicId) return null;
  const { data } = await supabase
    .from('zona')
    .select('id')
    .eq('public_id', publicId)
    .eq('idempresa', idempresa)
    .maybeSingle();
  return data?.id ?? null;
}

async function listarZonas(supabase, idempresa) {
  const { data, error } = await supabase
    .from('zona')
    .select('id, public_id, nombre, orden')
    .eq('idempresa', idempresa)
    .order('orden', { nullsFirst: false })
    .order('id');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────────────
// GET
// ──────────────────────────────────────────────────────────────────────────
async function listar(supabase, idempresa, tipo, res, { incluirAreas }) {
  const zonasRows = await listarZonas(supabase, idempresa);
  const zonaPublicById = new Map(zonasRows.map((z) => [z.id, z.public_id]));

  const { data: listasRows, error: e1 } = await supabase
    .from('lista')
    .select('id, public_id, nombre')
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .order('nombre');
  if (e1) throw new Error(e1.message);

  const listaIds = (listasRows ?? []).map((l) => l.id);
  let tarifasRows = [];
  if (listaIds.length) {
    const { data, error } = await supabase
      .from('lista_zona_tarifa')
      .select('idlista, idzona, importe')
      .in('idlista', listaIds);
    if (error) throw new Error(error.message);
    tarifasRows = data ?? [];
  }

  const tarifasPorLista = new Map();
  for (const t of tarifasRows) {
    if (!tarifasPorLista.has(t.idlista)) tarifasPorLista.set(t.idlista, []);
    tarifasPorLista.get(t.idlista).push({
      zonaId: zonaPublicById.get(t.idzona) ?? null,
      importe: Number(t.importe),
    });
  }

  const listaPublicById = new Map((listasRows ?? []).map((l) => [l.id, l.public_id]));
  const listas = (listasRows ?? []).map((l) => ({
    id: l.public_id,
    nombre: l.nombre,
    tarifas: tarifasPorLista.get(l.id) ?? [],
  }));

  const entidadesRows = await ENTIDADES[tipo].listar(supabase, idempresa);
  const entidades = entidadesRows.map((e) => ({
    id: e.publicId,
    nombre: e.nombre,
    listaId: e.idlista ? listaPublicById.get(e.idlista) ?? null : null,
  }));

  const zonas = zonasRows.map((z) => ({ id: z.public_id, nombre: z.nombre, orden: z.orden }));

  const payload = { listas, zonas, entidades };

  if (incluirAreas) {
    const { data: areasRows, error } = await supabase
      .from('area_flex')
      .select('public_id, nombre, idzona')
      .eq('idempresa', idempresa)
      .order('nombre');
    if (error) throw new Error(error.message);
    payload.areas = (areasRows ?? []).map((a) => ({
      id: a.public_id,
      nombre: a.nombre,
      zonaId: a.idzona ? zonaPublicById.get(a.idzona) ?? null : null,
    }));
  }

  return res.json(payload);
}

// ──────────────────────────────────────────────────────────────────────────
// POST — operaciones (op en el body)
// ──────────────────────────────────────────────────────────────────────────
async function crearLista(supabase, idempresa, tipo, nombre, res) {
  const nom = String(nombre ?? '').trim();
  if (!nom) return res.status(400).json({ error: 'El nombre es requerido' });

  const { data: lista, error } = await supabase
    .from('lista')
    .insert({ idempresa, tipo, nombre: nom })
    .select('id, public_id')
    .single();
  if (error) throw new Error(error.message);

  // Sembrar una tarifa en 0 por cada zona de la empresa.
  const zonas = await listarZonas(supabase, idempresa);
  if (zonas.length) {
    const rows = zonas.map((z) => ({ idlista: lista.id, idzona: z.id, importe: 0 }));
    const { error: e2 } = await supabase
      .from('lista_zona_tarifa')
      .upsert(rows, { onConflict: 'idlista,idzona', ignoreDuplicates: true });
    if (e2) throw new Error(e2.message);
  }

  return res.json({ ok: true, id: lista.public_id });
}

async function renombrarLista(supabase, idempresa, tipo, body, res) {
  const id = await resolverLista(supabase, idempresa, tipo, body.listaId);
  if (!id) return res.status(404).json({ error: 'Lista no encontrada' });
  const nom = String(body.nombre ?? '').trim();
  if (!nom) return res.status(400).json({ error: 'El nombre es requerido' });
  const { error } = await supabase.from('lista').update({ nombre: nom, updated_at: ahora() }).eq('id', id);
  if (error) throw new Error(error.message);
  return res.json({ ok: true });
}

async function setTarifa(supabase, idempresa, tipo, body, res) {
  const idlista = await resolverLista(supabase, idempresa, tipo, body.listaId);
  if (!idlista) return res.status(404).json({ error: 'Lista no encontrada' });
  const idzona = await resolverZona(supabase, idempresa, body.zonaId);
  if (!idzona) return res.status(404).json({ error: 'Zona no encontrada' });
  const importe = parsearImporte(body.importe, 'importe');

  const { error } = await supabase
    .from('lista_zona_tarifa')
    .upsert({ idlista, idzona, importe, updated_at: ahora() }, { onConflict: 'idlista,idzona' });
  if (error) throw new Error(error.message);
  return res.json({ ok: true });
}

async function setTarifasBulk(supabase, idempresa, tipo, body, res) {
  const idlista = await resolverLista(supabase, idempresa, tipo, body.listaId);
  if (!idlista) return res.status(404).json({ error: 'Lista no encontrada' });

  const zonas = await listarZonas(supabase, idempresa);
  if (!zonas.length) return res.json({ ok: true });

  const tieneImporte = body.importe !== undefined && body.importe !== null && body.importe !== '';
  const tienePorcentaje = body.porcentaje !== undefined && body.porcentaje !== null && body.porcentaje !== '';

  let rows;
  if (tieneImporte) {
    const importe = parsearImporte(body.importe, 'importe');
    rows = zonas.map((z) => ({ idlista, idzona: z.id, importe, updated_at: ahora() }));
  } else if (tienePorcentaje) {
    const pct = parsearImporte(body.porcentaje, 'porcentaje', { permitirNegativo: true });
    const factor = 1 + pct / 100;
    const { data: actuales } = await supabase
      .from('lista_zona_tarifa')
      .select('idzona, importe')
      .eq('idlista', idlista);
    const importePorZona = new Map((actuales ?? []).map((t) => [t.idzona, Number(t.importe)]));
    rows = zonas.map((z) => {
      const base = importePorZona.get(z.id) ?? 0;
      const nuevo = Math.max(0, Math.round(base * factor * 100) / 100);
      return { idlista, idzona: z.id, importe: nuevo, updated_at: ahora() };
    });
  } else {
    return res.status(400).json({ error: 'Enviá importe o porcentaje' });
  }

  const { error } = await supabase
    .from('lista_zona_tarifa')
    .upsert(rows, { onConflict: 'idlista,idzona' });
  if (error) throw new Error(error.message);
  return res.json({ ok: true });
}

async function asignarEntidad(supabase, idempresa, tipo, body, res) {
  const entidadInternalId = await ENTIDADES[tipo].buscar(supabase, idempresa, body.entidadId);
  if (!entidadInternalId) return res.status(404).json({ error: 'Entidad no encontrada' });

  let listaInternalId = null;
  if (body.listaId) {
    listaInternalId = await resolverLista(supabase, idempresa, tipo, body.listaId);
    if (!listaInternalId) return res.status(404).json({ error: 'Lista no encontrada' });
  }

  await ENTIDADES[tipo].asignar(supabase, entidadInternalId, listaInternalId);
  return res.json({ ok: true });
}

async function crearZona(supabase, idempresa, body, res) {
  const nom = String(body.nombre ?? '').trim();
  if (!nom) return res.status(400).json({ error: 'El nombre es requerido' });

  const zonas = await listarZonas(supabase, idempresa);
  const orden = zonas.reduce((m, z) => Math.max(m, z.orden ?? 0), 0) + 1;

  const { data: zona, error } = await supabase
    .from('zona')
    .insert({ idempresa, nombre: nom, orden })
    .select('id, public_id')
    .single();
  if (error) throw new Error(error.message);

  // Agregar la zona a todas las listas de la empresa (precio y costo) en 0.
  const { data: listas } = await supabase.from('lista').select('id').eq('idempresa', idempresa);
  if (listas?.length) {
    const rows = listas.map((l) => ({ idlista: l.id, idzona: zona.id, importe: 0 }));
    const { error: e2 } = await supabase
      .from('lista_zona_tarifa')
      .upsert(rows, { onConflict: 'idlista,idzona', ignoreDuplicates: true });
    if (e2) throw new Error(e2.message);
  }

  return res.json({ ok: true, id: zona.public_id });
}

async function renombrarZona(supabase, idempresa, body, res) {
  const idzona = await resolverZona(supabase, idempresa, body.zonaId);
  if (!idzona) return res.status(404).json({ error: 'Zona no encontrada' });
  const nom = String(body.nombre ?? '').trim();
  if (!nom) return res.status(400).json({ error: 'El nombre es requerido' });
  const { error } = await supabase.from('zona').update({ nombre: nom }).eq('id', idzona);
  if (error) throw new Error(error.message);
  return res.json({ ok: true });
}

async function borrarZona(supabase, idempresa, body, res) {
  const idzona = await resolverZona(supabase, idempresa, body.zonaId);
  if (!idzona) return res.status(404).json({ error: 'Zona no encontrada' });

  // Los paquetes que apuntaban a esta zona pasan a General (id=1) para no
  // violar la FK paquete.idzona. Las tarifas caen por CASCADE y area_flex.idzona
  // queda en NULL por ON DELETE SET NULL.
  await supabase.from('paquete').update({ idzona: 1 }).eq('idzona', idzona);

  const { error } = await supabase.from('zona').delete().eq('id', idzona).eq('idempresa', idempresa);
  if (error) throw new Error(error.message);
  return res.json({ ok: true });
}

async function asignarArea(supabase, idempresa, body, res) {
  const { data: area } = await supabase
    .from('area_flex')
    .select('id')
    .eq('public_id', body.areaId)
    .eq('idempresa', idempresa)
    .maybeSingle();
  if (!area) return res.status(404).json({ error: 'Área no encontrada' });

  let idzona = null;
  if (body.zonaId) {
    idzona = await resolverZona(supabase, idempresa, body.zonaId);
    if (!idzona) return res.status(404).json({ error: 'Zona no encontrada' });
  }

  const { error } = await supabase
    .from('area_flex')
    .update({ idzona, updated_at: ahora() })
    .eq('id', area.id);
  if (error) throw new Error(error.message);
  return res.json({ ok: true });
}

async function sincronizarAreasFlex(supabase, idempresa, res) {
  const { data: sellers, error: selErr } = await supabase
    .from('seller')
    .select('id, idmercadolibre')
    .eq('idempresa', idempresa);
  if (selErr) throw new Error(selErr.message);
  if (!sellers?.length) {
    return res.status(400).json({ error: 'No hay sellers para sincronizar zonas de Flex.' });
  }

  const ids = sellers.map((s) => s.id);
  const { data: tokens } = await supabase.from('meli_token').select('idseller').in('idseller', ids);
  const conToken = new Set((tokens ?? []).map((t) => t.idseller));
  const seller = sellers.find((s) => conToken.has(s.id));
  if (!seller) {
    return res.status(400).json({ error: 'Ningún seller tiene la cuenta de MercadoLibre conectada.' });
  }

  const areas = await obtenerAreasFlex(supabase, seller.id, seller.idmercadolibre);
  const rows = areas.map((a) => ({ idempresa, nombre: a.nombre, ml_ref: a.ref }));

  // ignoreDuplicates: no pisamos áreas ya cargadas (preserva su zona asignada).
  const { error } = await supabase
    .from('area_flex')
    .upsert(rows, { onConflict: 'idempresa,ml_ref', ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  return res.json({ ok: true, cantidad: rows.length });
}

async function guardar(supabase, idempresa, tipo, req, res, { manejaZonas }) {
  const body = req.body ?? {};
  switch (body.op) {
    case 'crearLista':
      return crearLista(supabase, idempresa, tipo, body.nombre, res);
    case 'renombrarLista':
      return renombrarLista(supabase, idempresa, tipo, body, res);
    case 'setTarifa':
      return setTarifa(supabase, idempresa, tipo, body, res);
    case 'setTarifasBulk':
      return setTarifasBulk(supabase, idempresa, tipo, body, res);
    case 'asignarEntidad':
      return asignarEntidad(supabase, idempresa, tipo, body, res);
    default:
      break;
  }

  // Zonas y áreas: solo el endpoint de precios (manejaZonas) las administra.
  if (manejaZonas) {
    switch (body.op) {
      case 'crearZona':
        return crearZona(supabase, idempresa, body, res);
      case 'renombrarZona':
        return renombrarZona(supabase, idempresa, body, res);
      case 'borrarZona':
        return borrarZona(supabase, idempresa, body, res);
      case 'asignarArea':
        return asignarArea(supabase, idempresa, body, res);
      case 'sincronizarAreasFlex':
        return sincronizarAreasFlex(supabase, idempresa, res);
      default:
        break;
    }
  }

  return res.status(400).json({ error: `Operación inválida: ${body.op ?? '(vacía)'}` });
}

async function borrar(supabase, idempresa, tipo, req, res) {
  const { listaId } = req.query;
  if (!listaId) return res.status(400).json({ error: 'listaId es requerido' });

  const { data, error } = await supabase
    .from('lista')
    .delete()
    .eq('public_id', listaId)
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .select('public_id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: 'Lista no encontrada' });

  return res.json({ ok: true });
}

// ──────────────────────────────────────────────────────────────────────────
// Handler compartido
// ──────────────────────────────────────────────────────────────────────────
export async function manejarListas(req, res, tipo) {
  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  const manejaZonas = tipo === 'precio';

  try {
    const supabase = getSupabase();
    const idempresa = usuario.id;

    if (req.method === 'GET') return await listar(supabase, idempresa, tipo, res, { incluirAreas: manejaZonas });
    if (req.method === 'POST') return await guardar(supabase, idempresa, tipo, req, res, { manejaZonas });
    if (req.method === 'DELETE') return await borrar(supabase, idempresa, tipo, req, res);

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const nombre = tipo === 'precio' ? 'precios' : 'costos';
    console.error(`[PacKen] Error en /api/${nombre}:`, err.message);
    return res.status(400).json({ error: err.message });
  }
}
