import { getSupabase } from '../ml.js';
import { autenticar } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tokenUser = autenticar(req, res);
  if (!tokenUser) return;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, email, dni, rol, idempresa, estado_solicitud')
      .eq('id', tokenUser.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({ usuario: data });
  } catch (err) {
    console.error('[PacKen] Error en /auth/me:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
