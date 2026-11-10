import conectar from '../_lib/ml/conectar.js';
import callback from '../_lib/ml/callback.js';
import invitacion from '../_lib/ml/invitacion.js';

// Dispatcher único para /api/ml/<action> (mismo patrón que /api/auth), para
// no sumar funciones nuevas al límite de 12 del plan Hobby de Vercel.
const rutas = { conectar, callback, invitacion };

export default function handler(req, res) {
  const fn = rutas[req.query.action];
  if (!fn) {
    return res.status(404).json({ error: 'Ruta de ml no encontrada' });
  }
  return fn(req, res);
}
