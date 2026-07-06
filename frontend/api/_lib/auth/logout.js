import { getSupabase } from '../ml.js';
import { revocarRefreshToken } from '../refreshTokens.js';
import { getRefreshCookie, clearRefreshCookie } from '../cookies.js';

// POST /api/auth/logout — revoca el refresh token en la DB y limpia la
// cookie. Siempre responde ok: el logout local nunca debe fallar.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tokenActual = getRefreshCookie(req);
    if (tokenActual) {
      await revocarRefreshToken(getSupabase(), tokenActual);
    }
  } catch (err) {
    console.error('[PacKen] Error revocando refresh token en logout:', err.message);
  }

  clearRefreshCookie(res);
  return res.json({ ok: true });
}
