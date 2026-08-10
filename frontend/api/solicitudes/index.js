import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol, hashPassword } from '../_lib/auth.js';

async function listar(res, supabase, idempresa) {
  const { data, error } = await supabase
    .from('usuario')
    .select('public_id, nombre, dni, estado_solicitud, created_at')
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // El cliente solo conoce el UUID opaco: es el identificador con el que
  // después hace el PATCH. Ni el id interno ni el email salen de acá.
  const solicitudes = (data ?? []).map(({ public_id, ...resto }) => ({
    id: public_id,
    ...resto,
  }));

  return res.json({ solicitudes });
}

// POST /api/solicitudes { nombre, email, dni, password }
// Alta de un transportista hecha por la empresa. Nace aceptado: no tiene
// sentido que la empresa se apruebe a sí misma la cuenta que acaba de crear.
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
    .select('public_id, nombre, dni, estado_solicitud, created_at')
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

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();
    if (req.method === 'POST') return await crear(req, res, supabase, usuario.id);
    return await listar(res, supabase, usuario.id);
  } catch (err) {
    console.error('[PacKen] Error en /api/solicitudes:', err.message);
    return res.status(req.method === 'POST' ? 400 : 500).json({ error: err.message });
  }
}
