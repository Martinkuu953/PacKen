import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, email, dni, estado_solicitud, created_at')
      .eq('rol', 'transportista')
      .eq('idempresa', usuario.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return res.json({ solicitudes: data ?? [] });
  } catch (err) {
    console.error('[PacKen] Error en listar solicitudes:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
