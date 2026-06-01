// src/services/MercadoLibre.js
// ─────────────────────────────────────────────────────────────────
//  Variables en .env:
//  VITE_ML_CLIENT_ID=791574040792507
//  VITE_ML_CLIENT_SECRET=iyc2OQyP25oLzZ3h9Y2KJPdNotM6RS27
// ─────────────────────────────────────────────────────────────────
import { supabase } from '../supabaseClient';

const ML_API = 'https://api.mercadolibre.com';

// Cache en memoria de access tokens por seller_id
// { [seller_id]: { token, expiry } }
const _tokenCache = {};

// ── 1. Renovar access token de un vendedor usando su refresh token ─
async function refreshTokenDeVendedor(refreshToken) {
  const params = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     import.meta.env.VITE_ML_CLIENT_ID,
    client_secret: import.meta.env.VITE_ML_CLIENT_SECRET,
    refresh_token: refreshToken,
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
  return {
    accessToken:  data.access_token,
    // Si ML devuelve un nuevo refresh token, lo actualizamos
    refreshToken: data.refresh_token || refreshToken,
    expiry:       Date.now() + (data.expires_in - 60) * 1000,
  };
}

// ── 2. Obtener token válido para un seller_id ─────────────────────
//  Busca en cache → si expiró, busca refresh token en Supabase → renueva
async function getTokenParaVendedor(sellerId) {
  const cached = _tokenCache[sellerId];
  if (cached && Date.now() < cached.expiry) {
    return cached.accessToken;
  }

  // Buscar refresh token en Supabase
  const { data, error } = await supabase
    .from('vendedor')
    .select('refresh_token')
    .eq('id_seller', String(sellerId))
    .single();

  if (error || !data?.refresh_token) {
    throw new Error(`Vendedor ${sellerId} no tiene token registrado en PacKen. Pedile que autorice la app.`);
  }

  // Renovar access token
  const tokens = await refreshTokenDeVendedor(data.refresh_token);

  // Guardar en cache
  _tokenCache[sellerId] = {
    accessToken: tokens.accessToken,
    expiry:      tokens.expiry,
  };

  // Si ML devolvió un nuevo refresh token, actualizarlo en Supabase
  if (tokens.refreshToken !== data.refresh_token) {
    await supabase
      .from('vendedor')
      .update({ refresh_token: tokens.refreshToken })
      .eq('id_seller', String(sellerId));
  }

  return tokens.accessToken;
}

// ── 3. Helper para llamadas autenticadas ─────────────────────────
async function mlFetch(path, sellerId) {
  const token = await getTokenParaVendedor(sellerId);

  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      'x-format-new': 'true',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

// ── 4. Parsear el QR de ML ────────────────────────────────────────
//  El QR devuelve JSON: {"id":"46795248507","sender_id":72555338,...}
//  O puede devolver solo un número
export function parsearQR(textoQR) {
  if (!textoQR) return null;

  // Intentar parsear como JSON primero
  try {
    const obj = JSON.parse(textoQR);
    if (obj.id && obj.sender_id) {
      return {
        shipmentId: String(obj.id),
        sellerId:   String(obj.sender_id),
      };
    }
  } catch { /* no es JSON */ }

  // Intentar extraer de URL
  try {
    const url = new URL(textoQR);
    const paramId = url.searchParams.get('shipment_id') || url.searchParams.get('id');
    if (paramId) return { shipmentId: paramId, sellerId: null };
  } catch { /* no es URL */ }

  // Extraer bloque numérico más largo
  let bloqueMaximo = '';
  let bloqueActual = '';
  for (const char of String(textoQR)) {
    if (char >= '0' && char <= '9') {
      bloqueActual += char;
    } else {
      if (bloqueActual.length > bloqueMaximo.length) bloqueMaximo = bloqueActual;
      bloqueActual = '';
    }
  }
  if (bloqueActual.length > bloqueMaximo.length) bloqueMaximo = bloqueActual;

  if (bloqueMaximo.length >= 9) {
    return { shipmentId: bloqueMaximo, sellerId: null };
  }

  return null;
}

// ── 5. Función principal: obtener datos del envío ────────────────
export async function obtenerDatosEnvio(shipmentId, sellerId) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!sellerId)   throw new Error('Seller ID requerido. Escaneá una etiqueta válida de ML.');

  const shipment = await mlFetch(`/shipments/${shipmentId}`, sellerId);

  const destAddr = shipment.destination?.shipping_address || {};
  const calle    = destAddr.street_name  || destAddr.address_line || '';
  const numero   = destAddr.street_number ? ` ${destAddr.street_number}` : '';
  const ciudad   = destAddr.city?.name   || '';
  const direccionCompleta = [calle + numero, ciudad].filter(Boolean).join(', ');

  return {
    id_envio_ml:   String(shipment.id),
    id_seller:     String(sellerId),
    vendedor:      null, // se puede obtener con /users/{sellerId} si se necesita
    estado:        shipment.status        || null,
    subestado:     shipment.substatus     || null,
    fecha:         shipment.date_created  || null,
    direccion:     direccionCompleta      || null,
    codigo_postal: destAddr.zip_code      || null,
  };
}

// ── 6. Registrar un vendedor nuevo en Supabase ───────────────────
//  Llamar esto cuando un vendedor autoriza tu app por primera vez
export async function registrarVendedor(sellerId, refreshToken) {
  const { error } = await supabase
    .from('vendedor')
    .upsert({
      id_seller:     String(sellerId),
      refresh_token: refreshToken,
    }, { onConflict: 'id_seller' });

  if (error) throw new Error(`Error registrando vendedor: ${error.message}`);
  return true;
}