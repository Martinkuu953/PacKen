import { getSupabase } from '../ml.js';
import { autenticar } from '../auth.js';
import { ESTADOS, canonizarEstado } from '../../../shared/estados.js';

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
    const estadoCanonico = canonizarEstado(estado);
    if (!estadoCanonico) {
      return res.status(400).json({ error: `Estado inválido: "${estado}"` });
    }

    const supabase = getSupabase();

    const { data: paquete } = await supabase
      .from('paquete')
      .select('estado, idempresa, idtransportista')
      .eq('id', Number(id))
      .maybeSingle();

    if (!paquete) {
      return res.status(404).json({ error: `Paquete con id=${id} no encontrado` });
    }

    const propio =
      usuario.rol === 'transportista'
        ? paquete.idtransportista === usuario.id
        : usuario.rol !== 'empresa' || paquete.idempresa === usuario.id;

    if (!propio) {
      return res.status(403).json({ error: 'No tenés permiso para modificar este paquete' });
    }

    // Un paquete solo se entrega si salió a reparto: marcar como entregado algo
    // que sigue en depósito (o que ya se entregó) descuadra la facturación,
    // porque el monto se calcula sobre los entregados.
    if (estadoCanonico === ESTADOS.ENTREGADO) {
      const estadoActual = canonizarEstado(paquete.estado);
      if (estadoActual !== ESTADOS.EN_CAMINO) {
        return res.status(409).json({
          error: `Solo se puede entregar un paquete en camino (este está "${paquete.estado}")`,
        });
      }
    }

    const updateData = { estado: estadoCanonico };
    if (estadoCanonico === ESTADOS.ENTREGADO) {
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
