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
      .select('public_id, nombre, dni, estado_solicitud, created_at')
      .eq('rol', 'transportista')
      .eq('idempresa', usuario.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // El cliente solo conoce el UUID opaco: es el identificador con el que
    // después hace el PATCH. Ni el id interno ni el email salen de acá.
    const solicitudes = (data ?? []).map(({ public_id, ...resto }) => ({
      id: public_id,
      ...resto,
    }));

    return res.json({ solicitudes });
  } catch (err) {
    console.error('[PacKen] Error en listar solicitudes:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
