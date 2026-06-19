import { dbConfigurado, query } from '../lib/db.js';

const ML_API = 'https://api.mercadolibre.com';

// ──────────────────────────────────────────────────────────────────────────
// MANEJO DE TOKENS (tabla meli_token, una sola fila, modo single-seller)
// ──────────────────────────────────────────────────────────────────────────

// Lee la fila de tokens guardada en la base
async function leerTokensDeDB() {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado en backend/.env');

  const { rows } = await query(
    'SELECT id, access_token, refresh_token, expires_at FROM meli_token ORDER BY id LIMIT 1'
  );

  if (!rows[0]) {
    throw new Error(
      'No hay tokens guardados en meli_token. Insertá manualmente el access_token y refresh_token iniciales (ver README/instrucciones).'
    );
  }

  return rows[0];
}

// Llama al endpoint OAuth de ML para renovar el access_token con el refresh_token
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

  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

// Renueva el token, lo guarda en meli_token y devuelve el nuevo access_token
async function renovarYGuardarTokens(filaId, refreshTokenActual) {
  const data = await pedirRefreshAML(refreshTokenActual);

  // ML rota el refresh_token en cada renovación: guardamos siempre el último que devuelve
  const nuevoAccessToken = data.access_token;
  const nuevoRefreshToken = data.refresh_token || refreshTokenActual;
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000); // 60s de margen

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

// Devuelve un access_token válido: si está vencido, lo renueva antes
async function getAccessTokenValido() {
  const fila = await leerTokensDeDB();

  const vencido = !fila.expires_at || new Date(fila.expires_at).getTime() <= Date.now();

  if (!vencido) {
    return fila.access_token;
  }

  return renovarYGuardarTokens(fila.id, fila.refresh_token);
}

// Fuerza una renovación reactiva (cuando ML devuelve 401 aunque el expires_at decía que estaba OK)
async function forzarRenovacion() {
  const fila = await leerTokensDeDB();
  return renovarYGuardarTokens(fila.id, fila.refresh_token);
}

// ──────────────────────────────────────────────────────────────────────────
// FETCH A LA API DE MERCADO LIBRE (con reintento automático en 401)
// ──────────────────────────────────────────────────────────────────────────

async function mlFetch(path, permitirReintento = true) {
  const accessToken = await getAccessTokenValido();

  const res = await fetch(`${ML_API}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-format-new': 'true',
    },
  });

  if (res.status === 401 && permitirReintento) {
    // El token venía "vigente" según expires_at pero ML lo rechazó: forzamos refresh y reintentamos una vez
    const nuevoToken = await forzarRenovacion();

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
// CONSULTA DE UN SHIPMENT (usado por /api/envios/:shipmentId, ya existente)
// ──────────────────────────────────────────────────────────────────────────

export async function obtenerDatosEnvio(shipmentId) {
  if (!shipmentId) throw new Error('Shipment ID requerido');

  const shipment = await mlFetch(`/shipments/${shipmentId}`);

  const destAddr = shipment.receiver_address || {};
  const direccionCompleta = destAddr.address_line || '';

  return {
    id_envio_ml: String(shipment.id),
    id_seller_ml: shipment.sender_id ? String(shipment.sender_id) : null,
    comprador: destAddr.receiver_name || null,
    estado: shipment.status || null,
    subestado: shipment.substatus || null,
    direccion: direccionCompleta || null,
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

// Busca el id interno (PK) del seller a partir del id de Mercado Libre (sender_id)
async function buscarIdSellerInterno(senderIdMl) {
  const { rows } = await query(
    'SELECT id FROM seller WHERE idmercadolibre = $1 LIMIT 1',
    [String(senderIdMl)]
  );

  if (!rows[0]) {
    throw new Error(
      `No existe un seller en la base con idmercadolibre = ${senderIdMl}. Cargalo en la tabla "seller" antes de escanear sus paquetes.`
    );
  }

  return rows[0].id;
}

export async function procesarEscaneoQR(shipmentId, tipo) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!ESTADO_POR_TIPO[tipo]) throw new Error('Tipo inválido: debe ser "colecta" o "reparto"');

  // 1) Traer el envío desde ML (con manejo de tokens incluido en mlFetch)
  const envio = await obtenerDatosEnvio(shipmentId);

  if (!envio.id_seller_ml) {
    throw new Error('El envío no trae sender_id, no se puede asociar a un seller.');
  }

  // 2) Resolver el seller interno
  const idSellerInterno = await buscarIdSellerInterno(envio.id_seller_ml);

  // 3) Definir estado según de dónde vino el escaneo (botón Colecta o Reparto)
  const estado = ESTADO_POR_TIPO[tipo];

  // TODO: reemplazar este idzona fijo por tu lógica real de mapeo CP → zona
  const idZona = 1;

  // 4) Upsert en la tabla paquete (requiere el UNIQUE en idenvioml del paso 1)
  const { rows } = await query(
    `INSERT INTO paquete
       (idenvioml, idseller, idzona, comprador, direccion, estado, codigopostal, fechaentrega)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (idenvioml)
     DO UPDATE SET
       comprador = EXCLUDED.comprador,
       direccion = EXCLUDED.direccion,
       estado = EXCLUDED.estado,
       codigopostal = EXCLUDED.codigopostal,
       fechaentrega = EXCLUDED.fechaentrega
     RETURNING *`,
    [
      envio.id_envio_ml,
      idSellerInterno,
      idZona,
      envio.comprador,
      envio.direccion,
      estado,
      envio.codigo_postal,
      envio.fecha_entrega,
    ]
  );

  return { ok: true, paquete: rows[0] };
}