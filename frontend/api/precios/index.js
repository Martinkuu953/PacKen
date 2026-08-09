import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// /api/precios — listas de precios (sellers) y listas de costos
// (transportistas). Es el mismo endpoint para los dos: `tipo` ('precio' o
// 'costo') decide contra qué tabla de miembros se trabaja, pero la forma de
// los datos (lista + monto por zona) es idéntica. Un solo dispatcher, igual
// que hoy, para no sumar otra Serverless Function (Vercel Hobby permite 12).
//
//   GET    ?tipo=precio|costo  → { zonas, listas, entidades }
//   POST   { tipo, accion, ... }
//     accion=crear-lista     { nombre, montos: [{ zonaId, monto }] }
//     accion=editar-lista    { listaId, nombre?, montos?: [{ zonaId, monto }] }
//     accion=asignar-miembro { listaId, miembroId }   (agrega o mueve)
//     accion=quitar-miembro  { miembroId }
//   DELETE ?tipo=precio|costo&id=<listaPublicId>
//
// Todo filtrado por la empresa del token: una empresa solo ve y toca su
// propia lista.

const TIPOS = ['precio', 'costo'];

function tablaMiembro(tipo) {
  return tipo === 'precio' ? 'lista_miembro_seller' : 'lista_miembro_transportista';
}

function columnaMiembro(tipo) {
  return tipo === 'precio' ? 'idseller' : 'idtransportista';
}

function parsearTipo(valor) {
  if (!TIPOS.includes(valor)) throw new Error("tipo debe ser 'precio' o 'costo'");
  return valor;
}

function parsearImporte(valor, campo) {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
    throw new Error(`${campo} debe ser un número`);
  }
  if (numero < 0) throw new Error(`${campo} no puede ser negativo`);
  return numero;
}

// Sellers o transportistas (aceptados) de la empresa: son los "candidatos" a
// entrar en una lista.
async function listarEntidades(supabase, idempresa, tipo) {
  if (tipo === 'precio') {
    const { data, error } = await supabase
      .from('seller')
      .select('id, public_id, nombre')
      .eq('idempresa', idempresa)
      .order('nombre');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data, error } = await supabase
    .from('usuario')
    .select('id, public_id, nombre')
    .eq('rol', 'transportista')
    .eq('estado_solicitud', 'aceptado')
    .eq('idempresa', idempresa)
    .order('nombre');
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Valida que el miembro (seller o transportista) sea de esta empresa y
// devuelve su fila. Mismo criterio que /api/sellers y /api/solicitudes.
async function resolverMiembro(supabase, idempresa, tipo, miembroPublicId) {
  const entidades = await listarEntidades(supabase, idempresa, tipo);
  return entidades.find((e) => e.public_id === miembroPublicId) ?? null;
}

async function resolverLista(supabase, idempresa, tipo, listaPublicId) {
  const { data, error } = await supabase
    .from('lista')
    .select('id, public_id, nombre')
    .eq('public_id', listaPublicId)
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function listar(supabase, idempresa, tipo, res) {
  const [listasRes, montosRes, miembrosRes, zonasRes, entidades] = await Promise.all([
    supabase.from('lista').select('id, public_id, nombre').eq('idempresa', idempresa).eq('tipo', tipo).order('nombre'),
    supabase.from('lista_zona_monto').select('idlista, idzona, monto'),
    supabase.from(tablaMiembro(tipo)).select(`idlista, ${columnaMiembro(tipo)}`),
    supabase.from('zona').select('id, public_id, nombre, cp_desde, cp_hasta').order('nombre'),
    listarEntidades(supabase, idempresa, tipo),
  ]);

  for (const r of [listasRes, montosRes, miembrosRes, zonasRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const listasIds = new Set((listasRes.data ?? []).map((l) => l.id));
  const zonaPorId = new Map((zonasRes.data ?? []).map((z) => [z.id, z]));
  const listaPorId = new Map((listasRes.data ?? []).map((l) => [l.id, l]));

  const montosPorLista = new Map();
  for (const m of montosRes.data ?? []) {
    if (!listasIds.has(m.idlista)) continue; // monto de una lista de otra empresa/tipo
    if (!montosPorLista.has(m.idlista)) montosPorLista.set(m.idlista, []);
    const zona = zonaPorId.get(m.idzona);
    montosPorLista.get(m.idlista).push({
      zonaId: zona?.public_id ?? null,
      zonaNombre: zona?.nombre ?? '—',
      monto: Number(m.monto),
    });
  }

  const columna = columnaMiembro(tipo);
  const listaPorMiembroId = new Map();
  for (const m of miembrosRes.data ?? []) {
    if (!listasIds.has(m.idlista)) continue;
    listaPorMiembroId.set(m[columna], m.idlista);
  }

  const listas = (listasRes.data ?? []).map((l) => ({
    id: l.public_id,
    nombre: l.nombre,
    montos: (montosPorLista.get(l.id) ?? []).sort((a, b) => a.zonaNombre.localeCompare(b.zonaNombre)),
  }));

  const entidadesRes = entidades.map((e) => {
    const idlista = listaPorMiembroId.get(e.id) ?? null;
    const lista = idlista != null ? listaPorId.get(idlista) : null;
    return {
      id: e.public_id,
      nombre: e.nombre,
      listaId: lista?.public_id ?? null,
      listaNombre: lista?.nombre ?? null,
    };
  });

  return res.json({
    zonas: (zonasRes.data ?? []).map((z) => ({
      id: z.public_id,
      nombre: z.nombre,
      cpDesde: z.cp_desde,
      cpHasta: z.cp_hasta,
    })),
    listas,
    entidades: entidadesRes,
  });
}

async function resolverZonas(supabase, montos) {
  if (!Array.isArray(montos) || montos.length === 0) return [];
  const { data, error } = await supabase.from('zona').select('id, public_id').in('public_id', montos.map((m) => m.zonaId));
  if (error) throw new Error(error.message);
  const zonaPorPublicId = new Map((data ?? []).map((z) => [z.public_id, z.id]));

  return montos.map((m) => {
    const idzona = zonaPorPublicId.get(m.zonaId);
    if (!idzona) throw new Error('Una de las zonas no existe');
    return { idzona, monto: parsearImporte(m.monto, 'monto') };
  });
}

async function crearLista(supabase, idempresa, tipo, req, res) {
  const { nombre, montos } = req.body ?? {};
  if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'nombre es requerido' });

  const montosResueltos = await resolverZonas(supabase, montos);

  let lista;
  try {
    const { data, error } = await supabase
      .from('lista')
      .insert({ idempresa, tipo, nombre: String(nombre).trim() })
      .select('id, public_id')
      .single();
    if (error) throw error;
    lista = data;
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Ya existe una lista con ese nombre' });
    throw new Error(err.message, { cause: err });
  }

  if (montosResueltos.length > 0) {
    const { error } = await supabase
      .from('lista_zona_monto')
      .insert(montosResueltos.map((m) => ({ idlista: lista.id, idzona: m.idzona, monto: m.monto })));
    if (error) throw new Error(error.message);
  }

  return res.status(201).json({ ok: true, id: lista.public_id });
}

async function editarLista(supabase, idempresa, tipo, req, res) {
  const { listaId, nombre, montos } = req.body ?? {};
  if (!listaId) return res.status(400).json({ error: 'listaId es requerido' });

  const lista = await resolverLista(supabase, idempresa, tipo, listaId);
  if (!lista) return res.status(404).json({ error: 'La lista no existe o no es de tu empresa' });

  if (nombre && String(nombre).trim()) {
    try {
      const { error } = await supabase
        .from('lista')
        .update({ nombre: String(nombre).trim(), updated_at: new Date().toISOString() })
        .eq('id', lista.id);
      if (error) throw error;
    } catch (err) {
      if (err.code === '23505') return res.status(400).json({ error: 'Ya existe una lista con ese nombre' });
      throw new Error(err.message, { cause: err });
    }
  }

  const montosResueltos = await resolverZonas(supabase, montos);
  if (montosResueltos.length > 0) {
    const { error } = await supabase
      .from('lista_zona_monto')
      .upsert(
        montosResueltos.map((m) => ({ idlista: lista.id, idzona: m.idzona, monto: m.monto, updated_at: new Date().toISOString() })),
        { onConflict: 'idlista,idzona' },
      );
    if (error) throw new Error(error.message);
  }

  return res.json({ ok: true });
}

async function asignarMiembro(supabase, idempresa, tipo, req, res) {
  const { listaId, miembroId } = req.body ?? {};
  if (!listaId || !miembroId) return res.status(400).json({ error: 'listaId y miembroId son requeridos' });

  const lista = await resolverLista(supabase, idempresa, tipo, listaId);
  if (!lista) return res.status(404).json({ error: 'La lista no existe o no es de tu empresa' });

  const miembro = await resolverMiembro(supabase, idempresa, tipo, miembroId);
  if (!miembro) {
    return res.status(404).json({
      error: tipo === 'precio' ? 'El seller no existe o no es de tu empresa' : 'El transportista no existe o no es de tu empresa',
    });
  }

  const columna = columnaMiembro(tipo);
  const { error } = await supabase
    .from(tablaMiembro(tipo))
    .upsert({ idlista: lista.id, [columna]: miembro.id }, { onConflict: columna });
  if (error) throw new Error(error.message);

  return res.json({ ok: true });
}

async function quitarMiembro(supabase, idempresa, tipo, req, res) {
  const { miembroId } = req.body ?? {};
  if (!miembroId) return res.status(400).json({ error: 'miembroId es requerido' });

  const miembro = await resolverMiembro(supabase, idempresa, tipo, miembroId);
  if (!miembro) {
    return res.status(404).json({
      error: tipo === 'precio' ? 'El seller no existe o no es de tu empresa' : 'El transportista no existe o no es de tu empresa',
    });
  }

  const { error } = await supabase.from(tablaMiembro(tipo)).delete().eq(columnaMiembro(tipo), miembro.id);
  if (error) throw new Error(error.message);

  return res.json({ ok: true });
}

async function guardar(supabase, idempresa, req, res) {
  const tipo = parsearTipo(req.body?.tipo);
  const accion = req.body?.accion;

  if (accion === 'crear-lista') return await crearLista(supabase, idempresa, tipo, req, res);
  if (accion === 'editar-lista') return await editarLista(supabase, idempresa, tipo, req, res);
  if (accion === 'asignar-miembro') return await asignarMiembro(supabase, idempresa, tipo, req, res);
  if (accion === 'quitar-miembro') return await quitarMiembro(supabase, idempresa, tipo, req, res);

  return res.status(400).json({ error: 'accion inválida' });
}

async function borrar(supabase, idempresa, req, res) {
  const tipo = parsearTipo(req.query.tipo);
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id es requerido' });

  const { data, error } = await supabase
    .from('lista')
    .delete()
    .eq('public_id', id)
    .eq('idempresa', idempresa)
    .eq('tipo', tipo)
    .select('public_id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: 'Lista no encontrada' });

  return res.json({ ok: true });
}

export default async function handler(req, res) {
  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();

    if (req.method === 'GET') return await listar(supabase, usuario.id, parsearTipo(req.query.tipo), res);
    if (req.method === 'POST') return await guardar(supabase, usuario.id, req, res);
    if (req.method === 'DELETE') return await borrar(supabase, usuario.id, req, res);

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[PacKen] Error en /api/precios:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
