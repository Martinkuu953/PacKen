import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// /api/listas — listas de precios (sellers) y listas de costos
// (transportistas), con un importe por zona cada una.
//
// "tipo" ('precio' | 'costo') decide sobre qué tabla se trabaja:
//   precio → seller.idlistaprecio
//   costo  → usuario.idlistaprecio, filtrado a rol = 'transportista'
//            (un transportista en esta app es una fila de "usuario", no la
//            tabla "transportista" que no se usa — ver /api/solicitudes)
//
//   GET    ?tipo=       → { listas, entidades, zonas }
//   POST   { tipo, ... } → crea una lista                { nombre, precios: [{zonaId, precio}] }
//   PUT    { tipo, ... } → edita nombre y/o precios       { id, nombre?, precios? }
//   DELETE ?tipo=&id=   → borra una lista (falla si tiene miembros asignados)
//   PATCH  { tipo, ... } → agrega/mueve/quita un miembro  { entidadId, listaId }  (listaId null = quitar)
//
// Todo filtrado por la empresa del token, mismo criterio que el resto de la API.

function resolverEntidad(tipo) {
  if (tipo === 'precio') return { tabla: 'seller', filtroRol: null };
  if (tipo === 'costo') return { tabla: 'usuario', filtroRol: 'transportista' };
  throw new Error("tipo debe ser 'precio' o 'costo'");
}

function parsearImporte(valor, campo) {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
    throw new Error(`${campo} debe ser un número`);
  }
  if (numero < 0) throw new Error(`${campo} no puede ser negativo`);
  return numero;
}

// Traduce [{ zonaId (public_id), precio }] a [{ idzona (interno), precio }],
// validando que cada zona exista.
async function resolverDetalle(supabase, precios) {
  if (precios === undefined) return undefined;
  if (!Array.isArray(precios)) throw new Error('precios debe ser una lista');

  const limpio = precios
    .filter((p) => p && p.zonaId)
    .map((p) => ({ zonaId: p.zonaId, precio: parsearImporte(p.precio, 'precio') }));

  if (!limpio.length) return [];

  const { data: zonas, error } = await supabase
    .from('zona')
    .select('id, public_id')
    .in('public_id', limpio.map((p) => p.zonaId));
  if (error) throw new Error(error.message);

  const idPorPublic = new Map((zonas ?? []).map((z) => [z.public_id, z.id]));
  return limpio.map((p) => {
    const idzona = idPorPublic.get(p.zonaId);
    if (!idzona) throw new Error('Una de las zonas no existe');
    return { idzona, precio: p.precio };
  });
}

async function listar(supabase, idempresa, tipo, res) {
  const { tabla, filtroRol } = resolverEntidad(tipo);

  const listasRes = await supabase
    .from('listaprecio')
    .select('id, public_id, nombre')
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .order('nombre');
  if (listasRes.error) throw new Error(listasRes.error.message);

  const listas = listasRes.data ?? [];
  const listaIds = listas.map((l) => l.id);

  let queryEntidades = supabase
    .from(tabla)
    .select('id, public_id, nombre, idlistaprecio')
    .eq('idempresa', idempresa)
    .order('nombre');
  if (filtroRol) queryEntidades = queryEntidades.eq('rol', filtroRol);

  const [detalleRes, zonasRes, entidadesRes] = await Promise.all([
    listaIds.length
      ? supabase.from('listaprecio_detalle').select('idlistaprecio, idzona, precio').in('idlistaprecio', listaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('zona').select('id, public_id, nombre, cp_desde, cp_hasta').order('nombre'),
    queryEntidades,
  ]);

  for (const r of [detalleRes, zonasRes, entidadesRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const zonaPorId = new Map((zonasRes.data ?? []).map((z) => [z.id, z]));
  const detallesPorLista = new Map();
  for (const d of detalleRes.data ?? []) {
    const zona = zonaPorId.get(d.idzona);
    if (!detallesPorLista.has(d.idlistaprecio)) detallesPorLista.set(d.idlistaprecio, []);
    detallesPorLista.get(d.idlistaprecio).push({
      zonaId: zona?.public_id ?? null,
      zonaNombre: zona?.nombre ?? '—',
      precio: Number(d.precio),
    });
  }

  const entidades = entidadesRes.data ?? [];
  const listaPublicPorId = new Map(listas.map((l) => [l.id, l.public_id]));
  const miembrosPorLista = new Map();
  for (const e of entidades) {
    if (e.idlistaprecio == null) continue;
    if (!miembrosPorLista.has(e.idlistaprecio)) miembrosPorLista.set(e.idlistaprecio, []);
    miembrosPorLista.get(e.idlistaprecio).push({ id: e.public_id, nombre: e.nombre });
  }

  return res.json({
    listas: listas.map((l) => ({
      id: l.public_id,
      nombre: l.nombre,
      precios: (detallesPorLista.get(l.id) ?? []).sort((a, b) => a.zonaNombre.localeCompare(b.zonaNombre)),
      miembros: miembrosPorLista.get(l.id) ?? [],
    })),
    entidades: entidades.map((e) => ({
      id: e.public_id,
      nombre: e.nombre,
      listaId: e.idlistaprecio != null ? listaPublicPorId.get(e.idlistaprecio) ?? null : null,
    })),
    zonas: (zonasRes.data ?? []).map((z) => ({
      id: z.public_id,
      nombre: z.nombre,
      cpDesde: z.cp_desde,
      cpHasta: z.cp_hasta,
    })),
  });
}

async function crear(supabase, idempresa, tipo, req, res) {
  const { nombre, precios } = req.body ?? {};
  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'nombre es requerido' });
  }

  const detalle = (await resolverDetalle(supabase, precios)) ?? [];

  const { data: lista, error } = await supabase
    .from('listaprecio')
    .insert({ idempresa, nombre: String(nombre).trim(), tipo })
    .select('id, public_id')
    .single();
  if (error) throw new Error(error.message);

  if (detalle.length) {
    const { error: errDetalle } = await supabase
      .from('listaprecio_detalle')
      .insert(detalle.map((d) => ({ idlistaprecio: lista.id, idzona: d.idzona, precio: d.precio })));
    if (errDetalle) throw new Error(errDetalle.message);
  }

  return res.status(201).json({ ok: true, id: lista.public_id });
}

async function editar(supabase, idempresa, tipo, req, res) {
  const { id, nombre, precios } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'id es requerido' });

  const { data: lista } = await supabase
    .from('listaprecio')
    .select('id')
    .eq('public_id', id)
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .maybeSingle();
  if (!lista) return res.status(404).json({ error: 'Lista no encontrada' });

  if (nombre !== undefined) {
    if (!String(nombre).trim()) return res.status(400).json({ error: 'nombre no puede estar vacío' });
    const { error } = await supabase
      .from('listaprecio')
      .update({ nombre: String(nombre).trim(), updated_at: new Date().toISOString() })
      .eq('id', lista.id);
    if (error) throw new Error(error.message);
  }

  const detalle = await resolverDetalle(supabase, precios);
  if (detalle !== undefined) {
    // Reemplaza todo el detalle en vez de un upsert selectivo: así una zona
    // que se saca del formulario también desaparece de la lista.
    const { error: errDel } = await supabase.from('listaprecio_detalle').delete().eq('idlistaprecio', lista.id);
    if (errDel) throw new Error(errDel.message);

    if (detalle.length) {
      const { error: errIns } = await supabase
        .from('listaprecio_detalle')
        .insert(detalle.map((d) => ({ idlistaprecio: lista.id, idzona: d.idzona, precio: d.precio })));
      if (errIns) throw new Error(errIns.message);
    }
  }

  return res.json({ ok: true });
}

async function borrar(supabase, idempresa, tipo, req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id es requerido' });

  const { data: lista } = await supabase
    .from('listaprecio')
    .select('id')
    .eq('public_id', id)
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .maybeSingle();
  if (!lista) return res.status(404).json({ error: 'Lista no encontrada' });

  const { tabla, filtroRol } = resolverEntidad(tipo);
  let queryMiembros = supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('idlistaprecio', lista.id);
  if (filtroRol) queryMiembros = queryMiembros.eq('rol', filtroRol);

  const { count, error: errCount } = await queryMiembros;
  if (errCount) throw new Error(errCount.message);

  if (count > 0) {
    const etiqueta = tipo === 'costo' ? 'transportistas' : 'sellers';
    return res
      .status(409)
      .json({ error: `La lista tiene ${count} ${etiqueta} asignados: moveelos o quitalos antes de borrar` });
  }

  const { error } = await supabase.from('listaprecio').delete().eq('id', lista.id);
  if (error) throw new Error(error.message);

  return res.json({ ok: true });
}

async function asignar(supabase, idempresa, tipo, req, res) {
  const { entidadId, listaId } = req.body ?? {};
  if (!entidadId) return res.status(400).json({ error: 'entidadId es requerido' });

  const { tabla, filtroRol } = resolverEntidad(tipo);

  let queryEntidad = supabase.from(tabla).select('id').eq('public_id', entidadId).eq('idempresa', idempresa);
  if (filtroRol) queryEntidad = queryEntidad.eq('rol', filtroRol);
  const { data: entidad } = await queryEntidad.maybeSingle();
  if (!entidad) return res.status(404).json({ error: 'No encontrado o no es de tu empresa' });

  let idListaInterno = null;
  if (listaId) {
    const { data: lista } = await supabase
      .from('listaprecio')
      .select('id')
      .eq('public_id', listaId)
      .eq('idempresa', idempresa)
      .eq('tipo', tipo)
      .maybeSingle();
    if (!lista) return res.status(404).json({ error: 'La lista no existe o no es de tu empresa' });
    idListaInterno = lista.id;
  }

  const { error } = await supabase.from(tabla).update({ idlistaprecio: idListaInterno }).eq('id', entidad.id);
  if (error) throw new Error(error.message);

  return res.json({ ok: true });
}

export default async function handler(req, res) {
  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  const tipo = req.method === 'GET' || req.method === 'DELETE' ? req.query.tipo : req.body?.tipo;
  if (tipo !== 'precio' && tipo !== 'costo') {
    return res.status(400).json({ error: "tipo debe ser 'precio' o 'costo'" });
  }

  try {
    const supabase = getSupabase();

    if (req.method === 'GET') return await listar(supabase, usuario.id, tipo, res);
    if (req.method === 'POST') return await crear(supabase, usuario.id, tipo, req, res);
    if (req.method === 'PUT') return await editar(supabase, usuario.id, tipo, req, res);
    if (req.method === 'DELETE') return await borrar(supabase, usuario.id, tipo, req, res);
    if (req.method === 'PATCH') return await asignar(supabase, usuario.id, tipo, req, res);

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[PacKen] Error en /api/listas:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
