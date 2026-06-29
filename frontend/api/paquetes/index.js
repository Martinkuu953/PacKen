import { getSupabase } from '../_lib/ml.js';
import { autenticar } from '../_lib/auth.js';

// GET /api/paquetes
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = autenticar(req, res);
  if (!usuario) return;

  try {
    const supabase = getSupabase();
    let query = supabase.from('paquete').select('*').order('fechaingreso', { ascending: false });

    if (usuario.rol === 'transportista') {
      query = query.eq('idtransportista', usuario.id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return res.json({ paquetes: data ?? [], origen: 'supabase' });
  } catch (err) {
    console.error('[PacKen] Error en listar paquetes:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
