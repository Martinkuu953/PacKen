import { dbConfigurado, query } from '../lib/db.js';

const ML_API = 'https://api.mercadolibre.com';

// Solicita un nuevo set de tokens a la API de Mercado Libre
export async function ejecutarRefreshEnML(refreshToken) {
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
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
  };
}

// Guarda o actualiza los datos de autorización en la tabla seller
export async function actualizarTokensEnBD(sellerId, tokens) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');

  await query(
    `INSERT INTO seller (id_seller, access_token, refresh_token, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id_seller) 
     DO UPDATE SET 
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [String(sellerId), tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
  );
}

// Fuerza la renovación de los tokens e impacta los cambios en la BD
export async function renovarYGuardarTokens(sellerId, currentRefreshToken) {
  const nuevosTokens = await ejecutarRefreshEnML(currentRefreshToken);
  await actualizarTokensEnBD(sellerId, nuevosTokens);
  return nuevosTokens.accessToken;
}

// Retorna el refresh_token actual de la BD (útil para reintentos en caso de error 401)
export async function obtenerRefreshToken(sellerId) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');
  const { rows } = await query('SELECT refresh_token FROM seller WHERE id_seller = $1', [String(sellerId)]);
  return rows[0]?.refresh_token;
}

// Retorna un token válido analizando proactivamente si está vencido
export async function getTokenParaVendedor(sellerId) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');

  const { rows } = await query(
    'SELECT access_token, refresh_token, expires_at FROM seller WHERE id_seller = $1',
    [String(sellerId)]
  );

  const sellerData = rows[0];
  if (!sellerData || !sellerData.refresh_token) {
    throw new Error(`Vendedor ${sellerId} no tiene sesión iniciada en PacKen. Debe autorizar la app.`);
  }

  const { access_token, refresh_token, expires_at } = sellerData;

  // Si existe el token y no venció, lo usamos directamente
  if (access_token && expires_at && new Date(expires_at).getTime() > Date.now()) {
    return access_token;
  }

  // Si no hay token o expiró, renovamos
  return await renovarYGuardarTokens(sellerId, refresh_token);
}