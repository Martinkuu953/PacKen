// Helpers de OAuth de Mercado Libre compartidos entre registrar-seller.mjs
// (ya tenías un refresh_token) y conectar-seller.mjs (lo consigue solo).

const ML_API = 'https://api.mercadolibre.com';

async function pedirToken(params) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ML OAuth error ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

export function pedirTokenPorRefresh({ clientId, clientSecret, refreshToken }) {
  return pedirToken({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

export function pedirTokenPorCodigo({ clientId, clientSecret, code, redirectUri }) {
  return pedirToken({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
}

export async function obtenerUsuarioML(accessToken) {
  const res = await fetch(`${ML_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ML API error ${res.status} en /users/me: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

// nickname es lo que el vendedor ve como su propio nombre público en ML;
// si no vino, caemos a first_name + last_name.
export function nombreDesdeUsuarioML(usuarioML, fallback) {
  return usuarioML.nickname || [usuarioML.first_name, usuarioML.last_name].filter(Boolean).join(' ') || fallback;
}

// Crea (o actualiza el nombre de) el seller, y hace upsert de su token.
export async function guardarSellerYToken(
  query,
  { idEmpresa, idMercadoLibre, nombre, accessToken, refreshToken, expiresIn },
) {
  const { rows: sellerRows } = await query(
    'SELECT id FROM seller WHERE idmercadolibre = $1 LIMIT 1',
    [String(idMercadoLibre)],
  );

  const yaExistia = sellerRows.length > 0;
  let idSellerInterno;

  if (yaExistia) {
    idSellerInterno = sellerRows[0].id;
    await query('UPDATE seller SET nombre = $1 WHERE id = $2', [nombre, idSellerInterno]);
  } else {
    const { rows } = await query(
      `INSERT INTO seller (idempresa, nombre, idmercadolibre)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [idEmpresa, nombre, String(idMercadoLibre)],
    );
    idSellerInterno = rows[0].id;
  }

  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);
  const { rows: tokenRows } = await query('SELECT id FROM meli_token WHERE idseller = $1 LIMIT 1', [
    idSellerInterno,
  ]);

  if (tokenRows.length > 0) {
    await query(
      `UPDATE meli_token
       SET access_token = $1, refresh_token = $2, expires_at = $3, fechaactualizacion = now()
       WHERE id = $4`,
      [accessToken, refreshToken, expiresAt, tokenRows[0].id],
    );
  } else {
    await query(
      `INSERT INTO meli_token (access_token, refresh_token, expires_at, idseller)
       VALUES ($1, $2, $3, $4)`,
      [accessToken, refreshToken, expiresAt, idSellerInterno],
    );
  }

  return { idSellerInterno, yaExistia };
}

export function enmascarar(t) {
  if (!t) return '(vacío)';
  return `${t.slice(0, 12)}…${t.slice(-6)} (len=${t.length})`;
}
