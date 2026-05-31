const ML_API = 'https://api.mercadolibre.com';
let _accessToken = null;
let _tokenExpiry = 0;

async function refreshAccessToken() {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     import.meta.env.VITE_ML_CLIENT_ID,
    client_secret: import.meta.env.VITE_ML_CLIENT_SECRET,
    refresh_token: import.meta.env.VITE_ML_REFRESH_TOKEN,
  });
 
  const res = await fetch(`${ML_API}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params,
  });
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`ML OAuth error: ${err.message || res.status}`);
  }
 
  const data = await res.json();
  _accessToken = data.access_token;
  // ML devuelve expires_in en segundos; restamos 60 s de margen
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _accessToken;
}
async function getToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  return refreshAccessToken();
}

async function mlFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${ML_API}${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${token}`,
      'x-format-new': 'true',
      ...(options.headers || {}),
    },
  });
 
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }
 
  return res.json();
}
async function getSellerNickname(sellerId) {
  if (!sellerId) return null;
  try {
    const data = await mlFetch(`/users/${sellerId}`);
    return data.nickname || data.first_name || String(sellerId);
  } catch {
    return String(sellerId);
  }
}
export async function obtenerDatosEnvio(shipmentId) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  const cleanId = String(shipmentId).replace(/\D/g, '');
 
  const shipment = await mlFetch(`/shipments/${cleanId}`);
  const destAddr =
    shipment.destination?.shipping_address ||
    shipment.receiver_address || 
    {};
 
  const calle    = destAddr.street_name   || destAddr.address_line || '';
  const numero   = destAddr.street_number ? ` ${destAddr.street_number}` : '';
  const ciudad   = destAddr.city?.name    || '';
  const direccionCompleta = [calle + numero, ciudad].filter(Boolean).join(', ');
 
  const codigoPostal = destAddr.zip_code || null;
  const sellerId     = shipment.origin?.sender_id || shipment.sender_id || null;
 
  // Nickname del vendedor (segunda llamada; si falla no rompe todo)
  const vendedor = await getSellerNickname(sellerId);
 
  return {
    id_envio_ml:   String(shipment.id),
    vendedor,
    id_seller:     sellerId ? String(sellerId) : null,
    estado:        shipment.status   || null,
    subestado:     shipment.substatus || null,
    fecha:         shipment.date_created || null,
    direccion:     direccionCompleta  || null,
    codigo_postal: codigoPostal,
  };
}