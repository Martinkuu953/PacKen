import { requireEmpresa } from '../_lib/auth.js';

// GET /api/transportistas/listar
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { empresa, supabase } = await requireEmpresa(req);

    const { data, error } = await supabase
      .from('transportista')
      .select('id, nombre, email, telefono, created_at')
      .eq('id_empresa', empresa.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return res.status(200).json({ ok: true, transportistas: data ?? [] });
  } catch (err) {
    console.error('[PacKen] Error en listar transportistas:', err.message);
    const status = err.message.startsWith('No autorizado') ? 401 : 400;
    return res.status(status).json({ error: err.message });
  }
}
