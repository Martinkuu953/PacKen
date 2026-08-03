import { getSupabase } from '../_lib/ml.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('usuario')
      .select('public_id, nombre')
      .eq('rol', 'empresa')
      .order('nombre');

    if (error) throw new Error(error.message);

    // Endpoint público (lo consume el formulario de registro): el id interno
    // no sale, el cliente elige la empresa por su UUID opaco.
    const empresas = (data ?? []).map(({ public_id, nombre }) => ({ id: public_id, nombre }));

    return res.json({ empresas });
  } catch (err) {
    console.error('[PacKen] Error en listar empresas:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
