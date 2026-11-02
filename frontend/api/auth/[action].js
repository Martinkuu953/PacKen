import asistente from '../_lib/auth/asistente.js';
import login from '../_lib/auth/login.js';
import logout from '../_lib/auth/logout.js';
import me from '../_lib/auth/me.js';
import perfil from '../_lib/auth/perfil.js';
import refresh from '../_lib/auth/refresh.js';
import registro from '../_lib/auth/registro.js';

// Dispatcher único para /api/auth/* — consolida las 6 rutas de auth en una
// sola Serverless Function (el plan Hobby de Vercel permite máximo 12).
// La URL real no cambia: /api/auth/login sigue resolviendo acá con
// req.query.action === "login", así que ni el frontend ni el Edge middleware
// (que matchea paths exactos) se ven afectados.
const rutas = { asistente, login, logout, me, perfil, refresh, registro };

// El chat del asistente trae el SDK de Claude y el de MCP: se carga recién
// cuando se usa, para no sumarle ese peso al arranque en frío del login.
const rutasDiferidas = {
  'asistente-chat': () => import('../_lib/asistente/chat.js'),
};

export default async function handler(req, res) {
  const diferida = rutasDiferidas[req.query.action];
  if (diferida) return (await diferida()).default(req, res);

  const fn = rutas[req.query.action];
  if (!fn) {
    return res.status(404).json({ error: 'Ruta de auth no encontrada' });
  }
  return fn(req, res);
}
