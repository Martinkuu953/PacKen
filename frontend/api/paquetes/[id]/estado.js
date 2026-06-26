import { getSupabase } from '../../_lib/ml.js';

const ESTADOS_VALIDOS = ['Ingresado', 'En camino', 'Entregado', 'Cancelado', 'Reprogramado'];

// PATCH /api/paquetes/:id/estado  { estado }
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const { estado } = req.body ?? {};

    if (!estado) {
      return res.status(400).json({ error: 'estado es requerido' });
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
