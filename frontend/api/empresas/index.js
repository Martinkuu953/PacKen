import { getSupabase } from '../_lib/ml.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre')
      .eq('rol', 'empresa')
      .order('nombre');

    if (error) throw new Error(error.message);

    return res.json({ empresas: data ?? [] });
  } catch (err) {
    console.error('[PacKen] Error en listar empresas:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
