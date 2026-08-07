import jwt from 'jsonwebtoken';
import { getSupabase, pedirTokenPorCodigo, obtenerUsuarioML, guardarSellerYToken } from '../ml.js';

const JWT_SECRET = process.env.JWT_SECRET;

function nombreDesdeUsuarioML(usuarioML) {
  return usuarioML.nickname || [usuarioML.first_name, usuarioML.last_name].filter(Boolean).join(' ') || `Seller ${usuarioML.id}`;
}

// GET /api/ml/callback — a esta URL redirige Mercado Libre después de que el
// vendedor aprueba el acceso. Es pública (no hay sesión de PacKen en este
// request: el navegador viene de mercadolibre.com); la empresa dueña de la
// conexión se recupera del "state" firmado que armó /api/ml/conectar.
export default async function callback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[PacKen] ML no autorizó la conexión:', error);
    return res.redirect(302, '/sellers?ml=error');
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET);
  } catch {
    console.error('[PacKen] state inválido o vencido en /api/ml/callback');
    return res.redirect(302, '/sellers?ml=error');
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/ml/callback`;
    const tokenData = await pedirTokenPorCodigo(code, redirectUri);
    const usuarioML = await obtenerUsuarioML(tokenData.access_token);
    const nombre = nombreDesdeUsuarioML(usuarioML);

    const supabase = getSupabase();
    await guardarSellerYToken(supabase, {
      idempresa: payload.idempresa,
      idMercadoLibre: usuarioML.id,
      nombre,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });

    console.log(`[PacKen] Seller conectado vía OAuth: "${nombre}" (idmercadolibre=${usuarioML.id}, idempresa=${payload.idempresa})`);
    return res.redirect(302, '/sellers?ml=ok');
  } catch (err) {
    console.error('[PacKen] Error en callback de ML:', err.message);
    return res.redirect(302, '/sellers?ml=error');
  }
}
