import { getSupabase, resolverSellerInterno, obtenerShipment } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';
import { responderError } from '../_lib/errores.js';

// GET /api/envios/:shipmentId?sellerId=<idMercadoLibre>
// Devuelve todos los datos del envío desde MercadoLibre usando el access token.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

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
    // requiereRol ya garantizó que es una empresa: su id es el de la empresa.
    const idSellerInterno = await resolverSellerInterno(supabase, sellerId, usuario.id);

    console.log(`[PacKen] GET envío ${shipmentId} (seller ML ${sellerId} → interno ${idSellerInterno})`);
    const envio = await obtenerShipment(supabase, idSellerInterno, shipmentId);

    return res.status(200).json({ ok: true, envio });
  } catch (err) {
    return responderError(res, err, 400, '/api/envios');
  }
}
