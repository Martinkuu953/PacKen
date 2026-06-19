import { 
  getTokenParaVendedor, 
  renovarYGuardarTokens, 
  ejecutarRefreshEnML, 
  actualizarTokensEnBD, 
  obtenerRefreshToken 
} from './tokens.js';

const ML_API = 'https://api.mercadolibre.com';

// Wrapper para consultas HTTP con reintento automático por token revocado
async function mlFetch(path, sellerId, permitirReintento = true) {
  const token = await getTokenParaVendedor(sellerId);

  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-format-new': 'true',
    },
  });

  // Si Mercado Libre rechaza el token (cayó antes de lo previsto), forzamos un refresh reactivo
  if (res.status === 401 && permitirReintento) {
    const currentRefreshToken = await obtenerRefreshToken(sellerId);

    if (currentRefreshToken) {
      try {
        const nuevoToken = await renovarYGuardarTokens(sellerId, currentRefreshToken);
        
        // Reintentamos la petición original
        const retryRes = await fetch(`${ML_API}${path}`, {
          headers: {
            Authorization: `Bearer ${nuevoToken}`,
            'x-format-new': 'true',
          },
        });

        if (!retryRes.ok) {
          const err = await retryRes.json().catch(() => ({}));
          throw new Error(err.message || `Error ${retryRes.status} en reintento de ${path}`);
        }

        return retryRes.json();
      } catch (errorRefresh) {
        throw new Error(`La sesión caducó por completo para el vendedor ${sellerId}: ${errorRefresh.message}`);
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

// Lógica de negocio logística pura
export async function obtenerDatosEnvio(shipmentId, sellerId) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!sellerId) throw new Error('Seller ID requerido para procesar el envío');

  const shipment = await mlFetch(`/shipments/${shipmentId}`, sellerId);

  const destAddr = shipment.destination?.shipping_address || {};
  const calle = destAddr.street_name || destAddr.address_line || '';
  const numero = destAddr.street_number ? ` ${destAddr.street_number}` : '';
  const ciudad = destAddr.city?.name || '';
  const direccionCompleta = [calle + numero, ciudad].filter(Boolean).join(', ');

  return {
    id_envio_ml: String(shipment.id),
    id_seller: String(sellerId),
    vendedor: null,
    estado: shipment.status || null,
    subestado: shipment.substatus || null,
    fecha: shipment.date_created || null,
    direccion: direccionCompleta || null,
    codigo_postal: destAddr.zip_code || null,
  };
}

// Punto de entrada para la vinculación del vendedor
export async function registrarVendedor(sellerId, refreshToken) {
  // Le delegamos todo al servicio de tokens
  const tokensIniciales = await ejecutarRefreshEnML(refreshToken);
  await actualizarTokensEnBD(sellerId, tokensIniciales);

  return { ok: true, message: 'Vendedor vinculado y tokens sincronizados con éxito' };
}