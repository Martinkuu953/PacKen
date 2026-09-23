import { waitUntil } from '@vercel/functions';
import { getSupabase, mlFetchConReintento, decidirEstadoDesdeML } from '../_lib/ml.js';
import { ESTADOS } from '../../shared/estados.js';

// POST /api/webhooks/mercadolibre
// ML envía notificaciones con topic "shipments" cuando cambia el estado de un envío.
// Payload: { resource: "/shipments/12345", topic: "shipments", user_id: 123, ... }
//
// Es la vía rápida de actualización (segundos). La red de contención, para las
// notificaciones que se pierdan o fallen, es POST /api/paquetes/sincronizar,
// que corre cada 15 minutos y usa exactamente la misma política de estados.
//
// ML espera la respuesta en menos de 500 ms y cuenta como fallida toda
// notificación que tarde más; con fallas sostenidas deja de notificar. Mirar
// el paquete en Supabase y preguntarle el estado a ML lleva ~1s, así que eso
// no puede pasar antes de responder: se contesta 200 apenas se valida el
// payload y el trabajo real va en waitUntil(), que mantiene viva la función
// después de cerrada la respuesta (sin esto el runtime la congela y el
// procesamiento queda a medias).

// Corre DESPUÉS de haber respondido: su único canal de salida es el log, no
// hay respuesta donde informar nada. Por eso no propaga: si rompe, el sync
// periódico levanta el cambio en la próxima corrida.
async function procesar(shipmentId) {
  try {
    const supabase = getSupabase();

    const { data: paquete } = await supabase
      .from('paquete')
      .select('id, estado, idseller')
      .eq('idenvioml', shipmentId)
      .limit(1)
      .maybeSingle();

    if (!paquete) {
      console.log(`[PacKen Webhook] Shipment ${shipmentId} no existe en nuestra DB, ignorando.`);
      return;
    }

    // No confiamos en el body de la notificación: ML solo avisa "algo cambió en
    // este shipment", así que el estado se lee de la API.
    const shipment = await mlFetchConReintento(supabase, paquete.idseller, `/shipments/${shipmentId}`);
    const nuevoEstado = decidirEstadoDesdeML(paquete.estado, shipment.status);

    console.log(
      `[PacKen Webhook] Shipment ${shipmentId}: ML="${shipment.status}" (sub="${shipment.substatus ?? '-'}"), ` +
        `interno="${paquete.estado}" → ${nuevoEstado ?? 'sin cambio'}`,
    );

    // El estado crudo de ML se guarda siempre, aunque el nuestro no se mueva:
    // deja rastro de que la notificación llegó y se procesó.
    const cambios = {
      estadoml: shipment.status ?? null,
      subestadoml: shipment.substatus ?? null,
      ml_sincronizado_en: new Date().toISOString(),
    };

    if (nuevoEstado) {
      cambios.estado = nuevoEstado;
      if (nuevoEstado === ESTADOS.ENTREGADO) {
        cambios.fechaentrega = shipment.status_history?.date_delivered || new Date().toISOString();
      }
    }

    const { error: upErr } = await supabase.from('paquete').update(cambios).eq('id', paquete.id);
    if (upErr) throw new Error(upErr.message);

    if (nuevoEstado) {
      console.log(`[PacKen Webhook] Paquete ${shipmentId} → "${nuevoEstado}"`);
    }
  } catch (err) {
    // Este endpoint es público: el detalle del error va al log de la función,
    // nunca al cuerpo de la respuesta (que además ya se envió).
    console.error(`[PacKen Webhook] Error procesando shipment ${shipmentId}:`, err);
  }
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Webhook activo' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resource, topic, user_id } = req.body ?? {};

  console.log(`[PacKen Webhook] Notificación recibida: topic="${topic}", resource="${resource}", user_id=${user_id}`);

  // Las validaciones baratas quedan acá, antes de responder: son comparaciones
  // en memoria y permiten contestar el descarte en el mismo tiro.
  if (topic !== 'shipments') {
    return res.status(200).json({ ok: true, ignored: true, reason: `topic "${topic}" no es shipments` });
  }

  const shipmentIdMatch = resource?.match(/\/shipments\/(\d+)/);
  if (!shipmentIdMatch) {
    return res.status(200).json({ ok: true, ignored: true, reason: 'No se pudo extraer shipmentId del resource' });
  }

  const shipmentId = shipmentIdMatch[1];

  waitUntil(procesar(shipmentId));

  // 200 inmediato. No dice si el paquete se actualizó (todavía no se sabe):
  // eso queda en el log. ML solo necesita saber que la recibimos.
  return res.status(200).json({ ok: true, encolado: true, shipmentId });
}
