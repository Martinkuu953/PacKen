import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol, hashPassword } from '../_lib/auth.js';

// GET /api/transportistas — la flota de la empresa.
async function listar(res, supabase, idempresa) {
  const { data, error } = await supabase
    .from('usuario')
    .select('public_id, nombre, dni, created_at')
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // El cliente solo conoce el UUID opaco. Ni el id interno ni el email salen
  // de acá.
  const transportistas = (data ?? []).map(({ public_id, ...resto }) => ({
    id: public_id,
    ...resto,
  }));

  return res.json({ transportistas });
}

// POST /api/transportistas { nombre, email, dni, password }
// Alta de un transportista hecha por la empresa: es la única forma de crear
// una cuenta de transportista, no existe autorregistro. Nace aceptado.
async function crear(req, res, supabase, idempresa) {
  const { nombre, email, dni, password } = req.body ?? {};

  if (!nombre || !email || !password || !dni) {
    return res.status(400).json({ error: 'nombre, email, dni y password son requeridos' });
  }

  const { data, error } = await supabase
    .from('usuario')
    .insert({
      nombre: String(nombre).trim(),
      email: String(email).toLowerCase().trim(),
      password: hashPassword(password),
      dni: String(dni).trim(),
      rol: 'transportista',
      idempresa,
      estado_solicitud: 'aceptado',
    })
    .select('public_id, nombre, dni, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El email o DNI ya está registrado' });
    }
    throw new Error(error.message);
  }

  const { public_id, ...resto } = data;
  return res.status(201).json({ transportista: { id: public_id, ...resto } });
}

// DELETE /api/transportistas?transportistaId=<public_id>
// Solo se puede borrar si no tiene paquetes asignados ni listas de costos con
// tarifas (FK desde paquete/lista_costos): se lo comunicamos al usuario en
// vez de dejar que reviente como error 500.
async function borrar(req, res, supabase, idempresa) {
  const { transportistaId } = req.query;
  if (!transportistaId) return res.status(400).json({ error: 'transportistaId es requerido' });

  const { data, error } = await supabase
    .from('usuario')
    .delete()
    .eq('public_id', transportistaId)
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa)
    .select('public_id')
    .maybeSingle();

  if (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'No se puede eliminar: el transportista tiene paquetes u otros datos asociados.',
      });
    }
    throw new Error(error.message);
  }
  if (!data) return res.status(404).json({ error: 'Transportista no encontrado' });

  return res.json({ ok: true });
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();
    if (req.method === 'POST') return await crear(req, res, supabase, usuario.id);
    if (req.method === 'DELETE') return await borrar(req, res, supabase, usuario.id);
    return await listar(res, supabase, usuario.id);
  } catch (err) {
    console.error('[PacKen] Error en /api/transportistas:', err.message);
    return res.status(req.method === 'POST' ? 400 : 500).json({ error: err.message });
  }
}
