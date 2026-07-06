export const REFRESH_COOKIE_NAME = 'packen_refresh';

const REFRESH_COOKIE_PATH = '/api/auth';

function baseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions());
}
