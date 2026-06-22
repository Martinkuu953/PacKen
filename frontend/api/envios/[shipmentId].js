import { getSupabase, resolverSellerInterno, obtenerShipment } from '../_lib/ml.js';

// GET /api/envios/:shipmentId?sellerId=<idMercadoLibre>
// Devuelve todos los datos del envío desde MercadoLibre usando el access token.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shipmentId } = req.query;
    const sellerId = req.query.sellerId;

    if (!shipmentId) {
      return res.status(400).json({ error: 'shipmentId es requerido' });
    }
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId (idmercadolibre) es requerido como query param' });
    }

    const supabase = getSupabase();
    const idSellerInterno = await resolverSellerInterno(supabase, sellerId);

    console.log(`[PacKen] GET envío ${shipmentId} (seller ML ${sellerId} → interno ${idSellerInterno})`);
    const envio = await obtenerShipment(supabase, idSellerInterno, shipmentId);

    return res.status(200).json({ ok: true, envio });
  } catch (err) {
    console.error('[PacKen] Error en /api/envios:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
