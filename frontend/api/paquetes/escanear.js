import { createClient } from '@supabase/supabase-js';

const ML_API = 'https://api.mercadolibre.com';

const ESTADO_POR_TIPO = {
  colecta: 'Ingresado',
  reparto: 'En camino',
};

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL y SUPABASE_KEY no configurados en Vercel');
  return createClient(url, key);
}

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

async function getValidToken(supabase, idSellerInterno) {
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

  if (!vencido) return { accessToken: tokenRow.access_token, tokenId: tokenRow.id, refreshToken: tokenRow.refresh_token };

  const data = await refreshMLToken(tokenRow.refresh_token);
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();

  await supabase
    .from('meli_token')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || tokenRow.refresh_token,
      expires_at: expiresAt,
      fechaactualizacion: new Date().toISOString(),
    })
    .eq('id', tokenRow.id);

  return { accessToken: data.access_token, tokenId: tokenRow.id, refreshToken: data.refresh_token || tokenRow.refresh_token };
}

async function callMLAPI(path, accessToken) {
  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-format-new': 'true',
    },
  });

  if (res.status === 401) {
    throw new Error('401_UNAUTHORIZED');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shipmentId, sellerId, tipo } = req.body ?? {};

    if (!shipmentId || !sellerId || !tipo) {
      return res.status(400).json({ error: 'shipmentId, sellerId y tipo son requeridos' });
    }

    if (!ESTADO_POR_TIPO[tipo]) {
      return res.status(400).json({ error: 'Tipo inválido: debe ser "colecta" o "reparto"' });
    }

    const supabase = getSupabase();

    const { data: seller, error: sellerErr } = await supabase
      .from('seller')
      .select('id')
      .eq('idmercadolibre', String(sellerId))
      .limit(1)
      .single();

    if (sellerErr || !seller) {
      return res.status(404).json({
        error: `No existe seller con idmercadolibre = ${sellerId}. Cargalo en la tabla "seller" primero.`,
      });
    }

    const idSellerInterno = seller.id;

    let { accessToken, tokenId, refreshToken } = await getValidToken(supabase, idSellerInterno);

    let shipment;
    try {
      shipment = await callMLAPI(`/shipments/${shipmentId}`, accessToken);
    } catch (err) {
      if (err.message === '401_UNAUTHORIZED') {
        const data = await refreshMLToken(refreshToken);
        accessToken = data.access_token;
        const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();

        await supabase
          .from('meli_token')
          .update({
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken,
            expires_at: expiresAt,
            fechaactualizacion: new Date().toISOString(),
          })
          .eq('id', tokenId);

        shipment = await callMLAPI(`/shipments/${shipmentId}`, accessToken);
      } else {
        throw err;
      }
    }

    const destAddr = shipment.receiver_address || {};
    const estado = ESTADO_POR_TIPO[tipo];
    const idenvioml = String(shipment.id);

    const paqueteData = {
      comprador: destAddr.receiver_name || null,
      direccion: destAddr.address_line || null,
      estado,
      codigopostal: destAddr.zip_code || null,
      fechaentrega: shipment.status_history?.date_delivered || null,
    };

    const { data: existente } = await supabase
      .from('paquete')
      .select('id')
      .eq('idenvioml', idenvioml)
      .limit(1)
      .maybeSingle();

    let paquete;
    if (existente) {
      const { data, error: upErr } = await supabase
        .from('paquete')
        .update(paqueteData)
        .eq('id', existente.id)
        .select()
        .single();

      if (upErr) throw new Error(upErr.message);
      paquete = data;
    } else {
      const { data, error: insErr } = await supabase
        .from('paquete')
        .insert({
          idenvioml,
          idseller: idSellerInterno,
          idzona: 1,
          ...paqueteData,
        })
        .select()
        .single();

      if (insErr) throw new Error(insErr.message);
      paquete = data;
    }

    return res.status(200).json({ ok: true, paquete });
  } catch (err) {
    console.error('[PacKen] Error en escanear:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
