// Módulo compartido para las funciones serverless de /api.
// Centraliza: cliente Supabase, manejo de tokens de MercadoLibre
// (refresh + persistencia + reintento en 401), resolución de seller,
// y el mapeo del shipment de ML a los datos del paquete.
//
// NOTA: los archivos/carpetas que empiezan con "_" dentro de /api NO se
// exponen como endpoints en Vercel, pero sí se pueden importar.

import { createClient } from '@supabase/supabase-js';

const ML_API = 'https://api.mercadolibre.com';

// Estado operativo del courier según la acción de escaneo.
export const ESTADO_POR_TIPO = {
  colecta: 'Ingresado',
  reparto: 'En camino',
};

// ──────────────────────────────────────────────────────────────────────────
// Supabase (service role → bypasea RLS, necesario para leer/escribir meli_token)
// ──────────────────────────────────────────────────────────────────────────
export function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no configurados en Vercel');
  return createClient(url, key);
}

// ──────────────────────────────────────────────────────────────────────────
// Traducción del estado de ML al estado interno del courier
// ──────────────────────────────────────────────────────────────────────────
export function traducirEstadoML(status) {
  switch (status) {
    case 'delivered':
      return 'Entregado';
    case 'cancelled':
      return 'Cancelado';
    case 'not_delivered':
      return 'Reprogramado';
    case 'shipped':
      return 'En camino';
    case 'pending':
    case 'handling':
    case 'ready_to_ship':
      return 'Ingresado';
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tokens de MercadoLibre
// ──────────────────────────────────────────────────────────────────────────
async function refreshMLToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error renovando token ML: ${err.message || res.status}`);
  }

  return res.json();
}

async function guardarTokens(supabase, tokenId, data, refreshTokenPrevio) {
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await supabase
    .from('meli_token')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshTokenPrevio,
      expires_at: expiresAt,
      fechaactualizacion: new Date().toISOString(),
    })
    .eq('id', tokenId);
  console.log(`[PacKen] Token renovado y guardado (meli_token id=${tokenId}), expira ${expiresAt}`);
}

// Devuelve un access token válido, renovándolo y persistiéndolo si está vencido.
export async function getValidToken(supabase, idSellerInterno) {
  const { data: tokenRow, error } = await supabase
    .from('meli_token')
    .select('id, access_token, refresh_token, expires_at')
    .eq('idseller', idSellerInterno)
    .limit(1)
    .single();

  if (error || !tokenRow) {
    throw new Error(`No hay tokens en meli_token para seller id=${idSellerInterno}`);
  }

  const vencido = !tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() <= Date.now();

  if (!vencido) {
    return { accessToken: tokenRow.access_token, tokenId: tokenRow.id, refreshToken: tokenRow.refresh_token };
  }

  console.log(`[PacKen] Token vencido para seller id=${idSellerInterno}, renovando...`);
  const data = await refreshMLToken(tokenRow.refresh_token);
  await guardarTokens(supabase, tokenRow.id, data, tokenRow.refresh_token);

  return {
    accessToken: data.access_token,
    tokenId: tokenRow.id,
    refreshToken: data.refresh_token || tokenRow.refresh_token,
  };
}

async function callMLAPI(path, accessToken) {
  // OJO: NO usar 'x-format-new': 'true'. Con ese header la respuesta cambia
  // (receiver_address desaparece y los datos quedan en destination.shipping_address,
  // y no viene sender_id). El formato por defecto trae todo plano en receiver_address.
  const res = await fetch(`${ML_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) throw new Error('401_UNAUTHORIZED');

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

// Llama a la API de ML con reintento automático: si da 401, fuerza un refresh
// del token, lo persiste, y reintenta una vez.
export async function mlFetchConReintento(supabase, idSellerInterno, path) {
  let { accessToken, tokenId, refreshToken } = await getValidToken(supabase, idSellerInterno);

  try {
    return await callMLAPI(path, accessToken);
  } catch (err) {
    if (err.message !== '401_UNAUTHORIZED') throw err;

    console.log(`[PacKen] 401 en ${path}, forzando refresh de token...`);
    const data = await refreshMLToken(refreshToken);
    await guardarTokens(supabase, tokenId, data, refreshToken);
    return callMLAPI(path, data.access_token);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Resolución del seller interno a partir del sender_id de ML
// ──────────────────────────────────────────────────────────────────────────
export async function resolverSellerInterno(supabase, sellerIdMl) {
  const { data: seller, error } = await supabase
    .from('seller')
    .select('id')
    .eq('idmercadolibre', String(sellerIdMl))
    .limit(1)
    .single();

  if (error || !seller) {
    throw new Error(
      `No existe seller con idmercadolibre = ${sellerIdMl}. Cargalo en la tabla "seller" primero.`
    );
  }
  return seller.id;
}

// ──────────────────────────────────────────────────────────────────────────
// Mapeo del shipment de ML → datos del paquete
// ──────────────────────────────────────────────────────────────────────────
function limpiarTelefono(tel) {
  if (!tel) return null;
  // ML enmascara el teléfono (ej. "XXXXXXX"); no tiene sentido mostrarlo.
  if (/^[X\s().+-]+$/i.test(tel)) return null;
  return tel;
}

export function mapShipment(shipment) {
  // Soporta ambos formatos de respuesta de ML:
  //  - legacy (default): datos planos en receiver_address + sender_id
  //  - nuevo (x-format-new): destination { receiver_name, receiver_phone, shipping_address }
  const dest = shipment.destination || {};
  const dir = shipment.receiver_address || dest.shipping_address || {};
  const hist = shipment.status_history || {};

  return {
    idEnvioMl: String(shipment.id),
    sellerId: shipment.sender_id != null ? String(shipment.sender_id) : null,

    // Datos del destinatario
    comprador: dir.receiver_name || dest.receiver_name || null,
    direccion: dir.address_line || null,
    codigoPostal: dir.zip_code || null,
    ciudad: dir.city?.name || null,
    provincia: dir.state?.name || null,
    telefono: limpiarTelefono(dir.receiver_phone || dest.receiver_phone),
    comentario: dir.comment || dest.comments || null,

    // Estado real de ML + estado interno traducido
    estadoMl: shipment.status || null,
    subestadoMl: shipment.substatus || null,
    estado: traducirEstadoML(shipment.status),

    // Logística / tracking
    trackingNumber: shipment.tracking_number || null,
    trackingMethod: shipment.tracking_method || null,
    tipoLogistica: shipment.logistic_type || shipment.logistic?.type || null,
    modo: shipment.mode || null,

    // Fechas
    fechaCreacion: shipment.date_created || null,
    fechaEnviado: hist.date_shipped || null,
    fechaEntrega: hist.date_delivered || null,
    ultimaActualizacion: shipment.last_updated || null,
  };
}

// Trae un shipment de ML ya mapeado.
export async function obtenerShipment(supabase, idSellerInterno, shipmentId) {
  const shipment = await mlFetchConReintento(supabase, idSellerInterno, `/shipments/${shipmentId}`);
  return mapShipment(shipment);
}
