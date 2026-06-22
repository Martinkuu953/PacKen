import { dbConfigurado, query } from '../lib/db.js';

const ML_API = 'https://api.mercadolibre.com';

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

export async function actualizarTokensEnBD(idSellerInterno, tokens) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');

  const { rows: existentes } = await query(
    'SELECT id FROM meli_token WHERE idseller = $1 LIMIT 1',
    [idSellerInterno]
  );

  if (existentes.length > 0) {
    await query(
      `UPDATE meli_token
       SET access_token = $1, refresh_token = $2, expires_at = $3, fechaactualizacion = now()
       WHERE id = $4`,
      [tokens.accessToken, tokens.refreshToken, tokens.expiresAt, existentes[0].id]
    );
  } else {
    await query(
      `INSERT INTO meli_token (access_token, refresh_token, expires_at, idseller)
       VALUES ($1, $2, $3, $4)`,
      [tokens.accessToken, tokens.refreshToken, tokens.expiresAt, idSellerInterno]
    );
  }
}

export async function renovarYGuardarTokens(idSellerInterno, currentRefreshToken) {
  const nuevosTokens = await ejecutarRefreshEnML(currentRefreshToken);
  await actualizarTokensEnBD(idSellerInterno, nuevosTokens);
  return nuevosTokens.accessToken;
}

export async function obtenerRefreshToken(idSellerInterno) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');
  const { rows } = await query(
    'SELECT refresh_token FROM meli_token WHERE idseller = $1 LIMIT 1',
    [idSellerInterno]
  );
  return rows[0]?.refresh_token;
}

export async function getTokenParaSeller(idSellerInterno) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');

  const { rows } = await query(
    'SELECT access_token, refresh_token, expires_at FROM meli_token WHERE idseller = $1 LIMIT 1',
    [idSellerInterno]
  );

  const tokenData = rows[0];
  if (!tokenData || !tokenData.refresh_token) {
    throw new Error(
      `Seller id=${idSellerInterno} no tiene tokens en meli_token. Debe autorizar la app.`
    );
  }

  const { access_token, refresh_token, expires_at } = tokenData;

  if (access_token && expires_at && new Date(expires_at).getTime() > Date.now()) {
    return access_token;
  }

  return renovarYGuardarTokens(idSellerInterno, refresh_token);
}
