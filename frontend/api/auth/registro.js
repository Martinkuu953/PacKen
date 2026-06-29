import { getSupabase } from '../_lib/ml.js';
import { hashPassword, generateToken } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nombre, email, password, dni, rol, idempresa } = req.body ?? {};

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, password y rol son requeridos' });
    }
    if (!['transportista', 'empresa'].includes(rol)) {
      return res.status(400).json({ error: 'rol debe ser "transportista" o "empresa"' });
    }
    if (rol === 'transportista' && !dni) {
      return res.status(400).json({ error: 'DNI es requerido para transportistas' });
    }
    if (rol === 'transportista' && !idempresa) {
      return res.status(400).json({ error: 'Debe seleccionar una empresa' });
    }

    const supabase = getSupabase();
    const hash = hashPassword(password);
    const estadoSolicitud = rol === 'transportista' ? 'pendiente' : null;

    const { data, error } = await supabase
      .from('usuario')
      .insert({
        nombre,
        email: email.toLowerCase().trim(),
        password: hash,
        dni: dni || null,
        rol,
        idempresa: idempresa || null,
        estado_solicitud: estadoSolicitud,
      })
      .select('id, nombre, email, dni, rol, idempresa, estado_solicitud, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El email o DNI ya está registrado' });
      }
      throw new Error(error.message);
    }

    const token = generateToken(data);
    return res.status(201).json({ usuario: data, token });
  } catch (err) {
    console.error('[PacKen] Error en registro:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
