import jwt from 'jsonwebtoken';
import { autenticar, requiereRol } from '../auth.js';

const JWT_SECRET = process.env.JWT_SECRET;

// GET /api/ml/conectar — arma la URL de autorización de ML y se la devuelve
// al frontend (que hace window.location.href = url). La empresa que pide la
// conexión viaja firmada en "state": /api/ml/callback la recupera de ahí, no
// hace falta que el navegador mande la cookie/token de sesión en el
// redirect de vuelta desde mercadolibre.com.
export default async function conectar(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const state = jwt.sign({ idempresa: usuario.id }, JWT_SECRET, { expiresIn: '10m' });
    const redirectUri = `https://${req.headers.host}/api/ml/callback`;
    const authDomain = process.env.ML_AUTH_DOMAIN || 'auth.mercadolibre.com.ar';

    const url = new URL(`https://${authDomain}/authorization`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', process.env.ML_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    return res.json({ url: url.toString() });
  } catch (err) {
    console.error('[PacKen] Error armando URL de conexión ML:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
