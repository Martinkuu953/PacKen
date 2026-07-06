// Manejo de la cookie httpOnly del refresh token para las funciones de /api.
// Path acotado a /api/auth: la cookie solo viaja a refresh/logout, no al resto.

export const REFRESH_COOKIE_NAME = 'packen_refresh';

const COOKIE_PATH = '/api/auth';

export function setRefreshCookie(res, token, expiresAt) {
  res.setHeader(
    'Set-Cookie',
    `${REFRESH_COOKIE_NAME}=${token}; Path=${COOKIE_PATH}; Expires=${new Date(expiresAt).toUTCString()}; HttpOnly; Secure; SameSite=Lax`,
  );
}

export function clearRefreshCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${REFRESH_COOKIE_NAME}=; Path=${COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  );
}

export function getRefreshCookie(req) {
  if (req.cookies?.[REFRESH_COOKIE_NAME]) return req.cookies[REFRESH_COOKIE_NAME];
  const header = req.headers?.cookie;
  if (!header) return null;
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return match ? match.slice(REFRESH_COOKIE_NAME.length + 1) : null;
}
