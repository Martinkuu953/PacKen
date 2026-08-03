import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

const ESTADOS_VALIDOS = ['Ingresado', 'En camino', 'Entregado', 'Cancelado', 'Reprogramado'];

// POST /api/paquetes/cambiar-estado  { id, estado }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

  try {
    const { id, estado } = req.body ?? {};

    if (!id || !estado) {
      return res.status(400).json({ error: 'id y estado son requeridos' });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido: "${estado}"` });
    }

    const supabase = getSupabase();

    if (usuario.rol === 'transportista') {
      const { data: paquete } = await supabase
        .from('paquete')
        .select('idtransportista')
        .eq('id', Number(id))
        .single();
      if (!paquete || paquete.idtransportista !== usuario.id) {
        return res.status(403).json({ error: 'No tenés permiso para modificar este paquete' });
      }
    } else if (usuario.rol === 'empresa') {
      const { data: paquete } = await supabase
        .from('paquete')
        .select('idempresa')
        .eq('id', Number(id))
        .single();
      if (!paquete || paquete.idempresa !== usuario.id) {
        return res.status(403).json({ error: 'No tenés permiso para modificar este paquete' });
      }
    }

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
