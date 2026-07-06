import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// POST /api/paquetes/simular-entregas
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('paquete')
      .update({ estado: 'Entregado', fechaentrega: new Date().toISOString() })
      .eq('estado', 'En camino')
      .eq('idempresa', usuario.id)
      .select();

    if (error) throw new Error(error.message);

    console.log(`[PacKen] Simulación: ${data.length} paquete(s) marcados como Entregado`);
    return res.status(200).json({ ok: true, actualizados: data.length, paquetes: data });
  } catch (err) {
    console.error('[PacKen] Error en simular-entregas:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
