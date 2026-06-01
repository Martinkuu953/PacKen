import { supabase } from '../lib/supabase.js';

const ML_API = 'https://api.mercadolibre.com';
const _tokenCache = {};

async function refreshTokenDeVendedor(refreshToken) {
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
    throw new Error(`ML OAuth error: ${err.message || res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiry: Date.now() + (data.expires_in - 60) * 1000,
  };
}

async function getTokenParaVendedor(sellerId) {
  const cached = _tokenCache[sellerId];
  if (cached && Date.now() < cached.expiry) {
    return cached.accessToken;
  }

  if (!supabase) {
    throw new Error('Supabase no configurado en el servidor');
  }

  const { data, error } = await supabase
    .from('vendedor')
    .select('refresh_token')
    .eq('id_seller', String(sellerId))
    .single();

  if (error || !data?.refresh_token) {
    throw new Error(
      `Vendedor ${sellerId} no tiene token registrado en PacKen. Pedile que autorice la app.`,
    );
  }

  const tokens = await refreshTokenDeVendedor(data.refresh_token);

  _tokenCache[sellerId] = {
    accessToken: tokens.accessToken,
    expiry: tokens.expiry,
  };

  if (tokens.refreshToken !== data.refresh_token) {
    await supabase
      .from('vendedor')
      .update({ refresh_token: tokens.refreshToken })
      .eq('id_seller', String(sellerId));
  }

  return tokens.accessToken;
}

async function mlFetch(path, sellerId) {
  const token = await getTokenParaVendedor(sellerId);

  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-format-new': 'true',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

export async function obtenerDatosEnvio(shipmentId, sellerId) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!sellerId) {
    throw new Error('Seller ID requerido. Escaneá una etiqueta válida de ML.');
  }

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

export async function registrarVendedor(sellerId, refreshToken) {
  if (!supabase) {
    throw new Error('Supabase no configurado en el servidor');
  }

  const { error } = await supabase.from('vendedor').upsert(
    {
      id_seller: String(sellerId),
      refresh_token: refreshToken,
    },
    { onConflict: 'id_seller' },
  );

  if (error) throw new Error(`Error registrando vendedor: ${error.message}`);
  return { ok: true };
}
