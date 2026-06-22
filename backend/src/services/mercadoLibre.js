import { dbConfigurado, query } from '../lib/db.js';

const ML_API = 'https://api.mercadolibre.com';

// ──────────────────────────────────────────────────────────────────────────
// TOKENS (tabla meli_token, per-seller via FK idseller → seller.id)
// ──────────────────────────────────────────────────────────────────────────

async function leerTokensDeSeller(idSellerInterno) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado en backend/.env');

  const { rows } = await query(
    'SELECT id, access_token, refresh_token, expires_at FROM meli_token WHERE idseller = $1 LIMIT 1',
    [idSellerInterno]
  );

  if (!rows[0]) {
    throw new Error(
      `No hay tokens en meli_token para el seller id=${idSellerInterno}. ` +
      'Insertá access_token y refresh_token en la tabla meli_token.'
    );
  }

  return rows[0];
}

async function pedirRefreshAML(refreshToken) {
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
    throw new Error(`Error renovando token en ML: ${err.message || res.status}`);
  }

  return res.json();
}

async function renovarYGuardarTokens(filaId, refreshTokenActual) {
  const data = await pedirRefreshAML(refreshTokenActual);

  const nuevoAccessToken = data.access_token;
  const nuevoRefreshToken = data.refresh_token || refreshTokenActual;
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

  await query(
    `UPDATE meli_token
     SET access_token = $1,
         refresh_token = $2,
         expires_at = $3,
         fechaactualizacion = now()
     WHERE id = $4`,
    [nuevoAccessToken, nuevoRefreshToken, expiresAt, filaId]
  );

  return nuevoAccessToken;
}

async function getAccessTokenValido(idSellerInterno) {
  const fila = await leerTokensDeSeller(idSellerInterno);
  const vencido = !fila.expires_at || new Date(fila.expires_at).getTime() <= Date.now();

  if (!vencido) return fila.access_token;

  return renovarYGuardarTokens(fila.id, fila.refresh_token);
}

async function forzarRenovacion(idSellerInterno) {
  const fila = await leerTokensDeSeller(idSellerInterno);
  return renovarYGuardarTokens(fila.id, fila.refresh_token);
}

// ──────────────────────────────────────────────────────────────────────────
// FETCH A LA API DE MERCADO LIBRE (con reintento automático en 401)
// ──────────────────────────────────────────────────────────────────────────

async function mlFetch(path, idSellerInterno, permitirReintento = true) {
  const accessToken = await getAccessTokenValido(idSellerInterno);

  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-format-new': 'true',
    },
  });

  if (res.status === 401 && permitirReintento) {
    const nuevoToken = await forzarRenovacion(idSellerInterno);

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
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

// ──────────────────────────────────────────────────────────────────────────
// RESOLVER SELLER INTERNO
// ──────────────────────────────────────────────────────────────────────────

async function buscarIdSellerInterno(senderIdMl) {
  const { rows } = await query(
    'SELECT id FROM seller WHERE idmercadolibre = $1 LIMIT 1',
    [String(senderIdMl)]
  );

  if (!rows[0]) {
    throw new Error(
      `No existe un seller con idmercadolibre = ${senderIdMl}. ` +
      'Cargalo en la tabla "seller" antes de escanear sus paquetes.'
    );
  }

  return rows[0].id;
}

// ──────────────────────────────────────────────────────────────────────────
// CONSULTA DE UN SHIPMENT
// ──────────────────────────────────────────────────────────────────────────

export async function obtenerDatosEnvio(shipmentId, idSellerInterno) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!idSellerInterno) throw new Error('Seller ID requerido');

  const shipment = await mlFetch(`/shipments/${shipmentId}`, idSellerInterno);

  const destAddr = shipment.receiver_address || {};

  return {
    id_envio_ml: String(shipment.id),
    id_seller_ml: shipment.sender_id ? String(shipment.sender_id) : null,
    comprador: destAddr.receiver_name || null,
    estado: shipment.status || null,
    subestado: shipment.substatus || null,
    direccion: destAddr.address_line || null,
    codigo_postal: destAddr.zip_code || null,
    fecha_entrega: shipment.status_history?.date_delivered || null,
    raw: shipment,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// ESCANEO DE QR: trae el shipment de ML y lo guarda/actualiza en `paquete`
// ──────────────────────────────────────────────────────────────────────────

const ESTADO_POR_TIPO = {
  colecta: 'Ingresado',
  reparto: 'En camino',
};

export async function procesarEscaneoQR(shipmentId, senderIdMl, tipo) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!senderIdMl) throw new Error('Seller ID (sender_id) requerido del QR');
  if (!ESTADO_POR_TIPO[tipo]) throw new Error('Tipo inválido: debe ser "colecta" o "reparto"');

  const idSellerInterno = await buscarIdSellerInterno(senderIdMl);

  const envio = await obtenerDatosEnvio(shipmentId, idSellerInterno);

  const estado = ESTADO_POR_TIPO[tipo];

  // TODO: reemplazar idzona fijo por lógica real de mapeo CP → zona
  const idZona = 1;

  const { rows: existentes } = await query(
    'SELECT id FROM paquete WHERE idenvioml = $1 LIMIT 1',
    [envio.id_envio_ml]
  );

  let paquete;
  if (existentes.length > 0) {
    const { rows } = await query(
      `UPDATE paquete
       SET comprador = $1, direccion = $2, estado = $3, codigopostal = $4, fechaentrega = $5
       WHERE id = $6
       RETURNING *`,
      [envio.comprador, envio.direccion, estado, envio.codigo_postal, envio.fecha_entrega, existentes[0].id]
    );
    paquete = rows[0];
  } else {
    const { rows } = await query(
      `INSERT INTO paquete (idenvioml, idseller, idzona, comprador, direccion, estado, codigopostal, fechaentrega)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [envio.id_envio_ml, idSellerInterno, idZona, envio.comprador, envio.direccion, estado, envio.codigo_postal, envio.fecha_entrega]
    );
    paquete = rows[0];
  }

  return { ok: true, paquete };
}

// ──────────────────────────────────────────────────────────────────────────
// REGISTRO DE VENDEDOR (alta de tokens OAuth en meli_token)
// ──────────────────────────────────────────────────────────────────────────

export async function registrarVendedor(senderIdMl, refreshToken) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');

  const idSellerInterno = await buscarIdSellerInterno(senderIdMl);

  const nuevosTokens = await pedirRefreshAML(refreshToken);
  const expiresAt = new Date(Date.now() + (nuevosTokens.expires_in - 60) * 1000);

  const { rows: existentes } = await query(
    'SELECT id FROM meli_token WHERE idseller = $1 LIMIT 1',
    [idSellerInterno]
  );

  if (existentes.length > 0) {
    await query(
      `UPDATE meli_token
       SET access_token = $1, refresh_token = $2, expires_at = $3, fechaactualizacion = now()
       WHERE id = $4`,
      [nuevosTokens.access_token, nuevosTokens.refresh_token || refreshToken, expiresAt, existentes[0].id]
    );
  } else {
    await query(
      `INSERT INTO meli_token (access_token, refresh_token, expires_at, idseller)
       VALUES ($1, $2, $3, $4)`,
      [nuevosTokens.access_token, nuevosTokens.refresh_token || refreshToken, expiresAt, idSellerInterno]
    );
  }

  return { ok: true, sellerId: senderIdMl, idInterno: idSellerInterno };
}
