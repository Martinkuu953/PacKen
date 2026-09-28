import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { autenticar, requiereRol } from '../auth.js';
import { responderError } from '../errores.js';

const JWT_SECRET = process.env.JWT_SECRET;

// El state se firma con el mismo secreto que las sesiones, pero con un
// audience propio: el callback exige este audience, y el middleware/autenticar
// no aceptan como sesión un JWT sin sub. Así ninguno de los dos tokens sirve
// en lugar del otro.
export const AUDIENCE_STATE = 'packen:ml-oauth-state';

// Cookie que ata el flujo OAuth al navegador que lo empezó. Sin ella, una
// empresa podía mandarle su link de autorización a un seller ajeno y quedarse
// con sus tokens de ML cuando el seller aceptaba. Path acotado a /api/ml: solo
// viaja al callback. SameSite=Lax alcanza porque la vuelta desde ML es una
// navegación GET de primer nivel.
export const COOKIE_NONCE = 'packen_ml_nonce';

// Base pública de la app. Fija por variable de entorno para que el
// redirect_uri no dependa del header Host de la request.
export function baseUrl(req) {
  const fija = process.env.APP_URL?.replace(/\/$/, '');
  return fija || `https://${req.headers.host}`;
}

// GET /api/ml/conectar — arma la URL de autorización de ML y se la devuelve
// al frontend (que hace window.location.href = url). La empresa que pide la
// conexión viaja firmada en "state"; el nonce, en el state y en la cookie.
export default async function conectar(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const nonce = randomBytes(24).toString('hex');
    const state = jwt.sign({ idempresa: usuario.id, nonce }, JWT_SECRET, {
      expiresIn: '10m',
      audience: AUDIENCE_STATE,
      algorithm: 'HS256',
    });
    const redirectUri = `${baseUrl(req)}/api/ml/callback`;
    const authDomain = process.env.ML_AUTH_DOMAIN || 'auth.mercadolibre.com.ar';

    const url = new URL(`https://${authDomain}/authorization`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', process.env.ML_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NONCE}=${nonce}; Path=/api/ml; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
    );
    return res.json({ url: url.toString() });
  } catch (err) {
    return responderError(res, err, 500, 'ml/conectar');
  }
}
