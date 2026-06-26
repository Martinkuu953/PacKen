import { getSupabase } from '../_lib/ml.js';

// POST /api/paquetes/simular-entregas
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('paquete')
      .update({ estado: 'Entregado', fechaentrega: new Date().toISOString() })
      .eq('estado', 'En camino')
      .select();

    if (error) throw new Error(error.message);

    console.log(`[PacKen] Simulación: ${data.length} paquete(s) marcados como Entregado`);
    return res.status(200).json({ ok: true, actualizados: data.length, paquetes: data });
  } catch (err) {
    console.error('[PacKen] Error en simular-entregas:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
