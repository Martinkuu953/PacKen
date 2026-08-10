import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';

// POST /api/paquetes/reasignar  { id, idtransportista }
// Pasa un paquete a otro transportista. Solo la empresa dueña del paquete.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const { id, idtransportista } = req.body ?? {};
    if (!id) {
      return res.status(400).json({ error: 'id es requerido' });
    }

    const supabase = getSupabase();

    const { data: paquete } = await supabase
      .from('paquete')
      .select('id, idempresa')
      .eq('id', Number(id))
      .maybeSingle();

    if (!paquete || paquete.idempresa !== usuario.id) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este paquete' });
    }

    // idtransportista es el public_id (UUID opaco); null = desasignar.
    let destino = null;
    if (idtransportista != null && idtransportista !== '') {
      const { data: transportista } = await supabase
        .from('usuario')
        .select('id, rol, idempresa, estado_solicitud')
        .eq('public_id', idtransportista)
        .maybeSingle();

      if (
        !transportista ||
        transportista.rol !== 'transportista' ||
        transportista.idempresa !== usuario.id
      ) {
        return res.status(400).json({ error: 'El transportista no pertenece a tu empresa' });
      }
      if (transportista.estado_solicitud !== 'aceptado') {
        return res.status(400).json({ error: 'El transportista todavía no está aprobado' });
      }
      destino = transportista.id;
    }

    const { error } = await supabase
      .from('paquete')
      .update({ idtransportista: destino })
      .eq('id', Number(id));

    if (error) throw new Error(error.message);

    console.log(`[PacKen] Paquete ${id} → transportista=${destino ?? 'sin asignar'}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[PacKen] Error en reasignar:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
