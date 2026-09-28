import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getSupabase, pedirTokenPorCodigo, obtenerUsuarioML, guardarSellerYToken } from '../ml.js';
import { AUDIENCE_STATE, COOKIE_NONCE, baseUrl } from './conectar.js';

const JWT_SECRET = process.env.JWT_SECRET;

function nombreDesdeUsuarioML(usuarioML) {
  return usuarioML.nickname || [usuarioML.first_name, usuarioML.last_name].filter(Boolean).join(' ') || `Seller ${usuarioML.id}`;
}

function leerCookie(req, nombre) {
  if (req.cookies?.[nombre]) return req.cookies[nombre];
  const par = (req.headers?.cookie ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nombre}=`));
  return par ? par.slice(nombre.length + 1) : null;
}

function mismoNonce(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// GET /api/ml/callback — a esta URL redirige Mercado Libre después de que el
// vendedor aprueba el acceso. Es pública (no hay header Authorization en una
// navegación); la empresa sale del "state" firmado, y la cookie de nonce
// prueba que quien vuelve es el mismo navegador que pidió la conexión.
export default async function callback(req, res) {
  const { code, state, error } = req.query;

  // La cookie es de un solo uso: se borra siempre, salga bien o mal.
  res.setHeader('Set-Cookie', `${COOKIE_NONCE}=; Path=/api/ml; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);

  if (error) {
    console.error('[PacKen] ML no autorizó la conexión:', error);
    return res.redirect(302, '/sellers?ml=error');
  }

  if (!code || !state) {
    return res.redirect(302, '/sellers?ml=error');
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET, { audience: AUDIENCE_STATE, algorithms: ['HS256'] });
    if (!payload.idempresa) throw new Error('state sin empresa');
  } catch {
    console.error('[PacKen] state inválido o vencido en /api/ml/callback');
    return res.redirect(302, '/sellers?ml=error');
  }

  if (!mismoNonce(leerCookie(req, COOKIE_NONCE), payload.nonce)) {
    console.error('[PacKen] /api/ml/callback sin cookie de nonce válida: link de otro navegador, se rechaza');
    return res.redirect(302, '/sellers?ml=error');
  }

  try {
    const redirectUri = `${baseUrl(req)}/api/ml/callback`;
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
    if (err.message === 'SELLER_DE_OTRA_EMPRESA') {
      console.warn(`[PacKen] OAuth rechazado: el seller ya pertenece a otra empresa (idempresa pedida=${payload.idempresa})`);
      return res.redirect(302, '/sellers?ml=otra-empresa');
    }
    console.error('[PacKen] Error en callback de ML:', err.message);
    return res.redirect(302, '/sellers?ml=error');
  }
}
