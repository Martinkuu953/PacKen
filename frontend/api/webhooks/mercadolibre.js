import { getSupabase, mlFetchConReintento, traducirEstadoML } from '../_lib/ml.js';

// POST /api/webhooks/mercadolibre
// ML envía notificaciones con topic "shipments" cuando cambia el estado de un envío.
// Payload: { resource: "/shipments/12345", topic: "shipments", user_id: 123, ... }
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Webhook activo' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { resource, topic, user_id } = req.body ?? {};

    console.log(`[PacKen Webhook] Notificación recibida: topic="${topic}", resource="${resource}", user_id=${user_id}`);

    if (topic !== 'shipments') {
      return res.status(200).json({ ok: true, ignored: true, reason: `topic "${topic}" no es shipments` });
    }

    const shipmentIdMatch = resource?.match(/\/shipments\/(\d+)/);
    if (!shipmentIdMatch) {
      return res.status(200).json({ ok: true, ignored: true, reason: 'No se pudo extraer shipmentId del resource' });
    }

    const shipmentId = shipmentIdMatch[1];
    const supabase = getSupabase();

    const { data: paquete } = await supabase
      .from('paquete')
      .select('id, estado, idseller')
      .eq('idenvioml', shipmentId)
      .limit(1)
      .maybeSingle();

    if (!paquete) {
      console.log(`[PacKen Webhook] Shipment ${shipmentId} no existe en nuestra DB, ignorando.`);
      return res.status(200).json({ ok: true, ignored: true, reason: 'Paquete no registrado' });
    }

    if (paquete.estado === 'Entregado') {
      console.log(`[PacKen Webhook] Paquete ${shipmentId} ya está Entregado, ignorando.`);
      return res.status(200).json({ ok: true, ignored: true, reason: 'Ya entregado' });
    }

    const shipment = await mlFetchConReintento(supabase, paquete.idseller, `/shipments/${shipmentId}`);
    const estadoTraducido = traducirEstadoML(shipment.status);

    console.log(`[PacKen Webhook] Shipment ${shipmentId}: status="${shipment.status}" → "${estadoTraducido}"`);

    if (estadoTraducido === 'Entregado') {
      const { error: upErr } = await supabase
        .from('paquete')
        .update({
          estado: 'Entregado',
          fechaentrega: shipment.status_history?.date_delivered || new Date().toISOString(),
        })
        .eq('id', paquete.id);

      if (upErr) throw new Error(upErr.message);
      console.log(`[PacKen Webhook] Paquete ${shipmentId} marcado como Entregado por webhook`);
      return res.status(200).json({ ok: true, updated: true, estado: 'Entregado' });
    }

    return res.status(200).json({ ok: true, ignored: true, reason: `Estado ML "${shipment.status}" no es delivered` });
  } catch (err) {
    // Este endpoint es público: el detalle del error va al log de la función,
    // nunca al cuerpo de la respuesta. Se responde 200 igual para que ML no
    // encole reintentos de una notificación que no vamos a poder procesar.
    console.error('[PacKen Webhook] Error:', err);
    return res.status(200).json({ ok: false });
  }
}
