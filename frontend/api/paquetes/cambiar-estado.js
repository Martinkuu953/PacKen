import { getSupabase } from '../_lib/ml.js';

const ESTADOS_VALIDOS = ['Ingresado', 'En camino', 'Entregado', 'Cancelado', 'Reprogramado'];

// POST /api/paquetes/cambiar-estado  { id, estado }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, estado } = req.body ?? {};

    if (!id || !estado) {
      return res.status(400).json({ error: 'id y estado son requeridos' });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido: "${estado}"` });
    }

    const supabase = getSupabase();

    const updateData = { estado };
    if (estado === 'Entregado') {
      updateData.fechaentrega = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('paquete')
      .update(updateData)
      .eq('id', Number(id))
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Paquete con id=${id} no encontrado`);

    console.log(`[PacKen] Paquete ${id} → estado="${estado}"`);
    return res.status(200).json({ ok: true, paquete: data });
  } catch (err) {
    console.error('[PacKen] Error en cambiar estado:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
