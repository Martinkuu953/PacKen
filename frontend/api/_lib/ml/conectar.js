import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { ErrorPublico, responderError } from '../errores.js';

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

// El seller que se va a conectar, por su public_id (lo único que conoce el
// cliente), siempre acotado a la empresa: un public_id ajeno da 404.
export async function buscarSellerDeEmpresa(supabase, publicId, idempresa) {
  if (!publicId) throw new ErrorPublico('sellerId es requerido');
  const { data, error } = await supabase
    .from('seller')
    .select('id, public_id, nombre')
    .eq('public_id', String(publicId))
    .eq('idempresa', idempresa)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ErrorPublico('Seller no encontrado', 404);
  return data;
}

// Arranca el OAuth de ML para el seller `idseller` en el navegador que hace esta
// request: firma el state, deja la cookie de nonce y devuelve la URL de
// autorización. Lo comparten las dos puertas de entrada al flujo:
//
//   - "Conectar desde esta compu", con la empresa logueada (conectar, abajo)
//   - el link de invitación que abre el seller en su celular (invitacion.js)
//
// En las dos, la cookie queda en el navegador que va a ir a ML, así que el
// chequeo del callback (cookie == nonce del state) es el mismo para ambas.
// El seller ya existe (lo crea la empresa en "Nuevo seller"): el OAuth solo le
// suma la cuenta de ML, así que su id viaja firmado en el state y el callback
// completa esa fila en vez de crear otra. `via` viaja solo para que el
// callback sepa a qué pantalla devolver a quien vuelve de ML.
export function iniciarAutorizacion(req, res, { idempresa, idseller, via }) {
  const nonce = randomBytes(24).toString('hex');
  const state = jwt.sign({ idempresa, idseller, nonce, via }, JWT_SECRET, {
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
  return url.toString();
}

// GET /api/ml/conectar?sellerId=<public_id> — conecta el seller desde la compu
// de la empresa: arma la URL de autorización de ML y se la devuelve al frontend
// (que hace window.location.href = url). Empresa y seller viajan firmados en
// "state"; el nonce, en el state y en la cookie.
export default async function conectar(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const seller = await buscarSellerDeEmpresa(getSupabase(), req.query?.sellerId, usuario.id);
    const url = iniciarAutorizacion(req, res, { idempresa: usuario.id, idseller: seller.id, via: 'empresa' });
    return res.json({ url });
  } catch (err) {
    return responderError(res, err, 500, 'ml/conectar');
  }
}
