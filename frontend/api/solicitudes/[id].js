import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const { id } = req.query;
    const { estado } = req.body ?? {};

    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser "aceptado" o "rechazado"' });
    }

    const supabase = getSupabase();
    // `id` es el public_id (UUID opaco), no el id interno. El filtro por
    // idempresa sigue garantizando que una empresa solo toque a los suyos.
    const { data, error } = await supabase
      .from('usuario')
      .update({ estado_solicitud: estado })
      .eq('public_id', id)
      .eq('rol', 'transportista')
      .eq('idempresa', usuario.id)
      .select('public_id, nombre, dni, estado_solicitud')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const { public_id, ...resto } = data;
    return res.json({ ok: true, transportista: { id: public_id, ...resto } });
  } catch (err) {
    console.error('[PacKen] Error en actualizar solicitud:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
