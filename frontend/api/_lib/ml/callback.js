import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  getSupabase,
  pedirTokenPorCodigo,
  obtenerUsuarioML,
  conectarSeller,
  RECHAZOS_CONEXION,
} from '../ml.js';
import { AUDIENCE_STATE, COOKIE_NONCE, baseUrl } from './conectar.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Resultado que ve quien vuelve de ML, por cada rechazo de conectarSeller.
// Las dos pantallas (/sellers y /conectar-ml) tienen un texto para cada uno.
const RESULTADO_POR_RECHAZO = {
  [RECHAZOS_CONEXION.OTRA_EMPRESA]: 'otra-empresa',
  [RECHAZOS_CONEXION.OTRO_SELLER]: 'duplicado',
  [RECHAZOS_CONEXION.OTRA_CUENTA]: 'otra-cuenta',
};

function leerCookie(req, nombre) {
  if (req.cookies?.[nombre]) return req.cookies[nombre];
  const par = (req.headers?.cookie ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nombre}=`));
  return par ? par.slice(nombre.length + 1) : null;
}

// A qué pantalla se vuelve depende de quién arrancó el flujo. La empresa vuelve
// a Sellers; el seller que vino por un link de invitación no tiene sesión en
// PacKen (/sellers lo rebotaría al login), así que va a la página pública
// /conectar-ml.
//
// `via` se lee del state SIN verificar la firma, a propósito: tiene que
// funcionar también cuando lo que está mal es justamente el state, para que el
// seller vea un error entendible y no la pantalla de login. Es seguro porque lo
// único que decide es cuál de dos páginas internas se muestra; la verificación
// de verdad (firma, vencimiento, nonce) es la de más abajo.
function destino(state) {
  const via = typeof state === 'string' ? jwt.decode(state)?.via : null;
  return via === 'invitacion'
    ? (resultado) => `/conectar-ml?estado=${resultado}`
    : (resultado) => `/sellers?ml=${resultado}`;
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
  const volver = destino(state);

  // La cookie es de un solo uso: se borra siempre, salga bien o mal.
  res.setHeader('Set-Cookie', `${COOKIE_NONCE}=; Path=/api/ml; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);

  if (error) {
    console.error('[PacKen] ML no autorizó la conexión:', error);
    return res.redirect(302, volver('error'));
  }

  if (!code || !state) {
    return res.redirect(302, volver('error'));
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET, { audience: AUDIENCE_STATE, algorithms: ['HS256'] });
    // Un state sin seller es de antes de que el alta pasara a "Nuevo seller"
    // (o de un flujo a medio terminar en ese deploy): se rechaza en vez de
    // crear un seller suelto, sin lista.
    if (!payload.idempresa || !payload.idseller) throw new Error('state sin empresa o seller');
  } catch {
    console.error('[PacKen] state inválido o vencido en /api/ml/callback');
    return res.redirect(302, volver('error'));
  }

  if (!mismoNonce(leerCookie(req, COOKIE_NONCE), payload.nonce)) {
    console.error('[PacKen] /api/ml/callback sin cookie de nonce válida: link de otro navegador, se rechaza');
    return res.redirect(302, volver('error'));
  }

  try {
    const redirectUri = `${baseUrl(req)}/api/ml/callback`;
    const tokenData = await pedirTokenPorCodigo(code, redirectUri);
    const usuarioML = await obtenerUsuarioML(tokenData.access_token);

    const { reconexion } = await conectarSeller(getSupabase(), {
      idseller: payload.idseller,
      idempresa: payload.idempresa,
      idMercadoLibre: usuarioML.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    });

    console.log(
      `[PacKen] Seller ${payload.idseller} ${reconexion ? 'reconectado' : 'conectado'} con ML ` +
        `(cuenta "${usuarioML.nickname ?? '-'}", idmercadolibre=${usuarioML.id}, empresa ${payload.idempresa})`,
    );
    return res.redirect(302, volver('ok'));
  } catch (err) {
    const resultado = RESULTADO_POR_RECHAZO[err.message];
    if (resultado) {
      console.warn(`[PacKen] OAuth rechazado (${err.message}): seller ${payload.idseller}, empresa ${payload.idempresa}`);
      return res.redirect(302, volver(resultado));
    }
    console.error('[PacKen] Error en callback de ML:', err.message);
    return res.redirect(302, volver('error'));
  }
}
