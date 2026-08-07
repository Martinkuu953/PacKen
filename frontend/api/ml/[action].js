import conectar from '../_lib/ml/conectar.js';
import callback from '../_lib/ml/callback.js';

// Dispatcher único para /api/ml/<action> (mismo patrón que /api/auth), para
// no sumar 2 funciones nuevas al límite de 12 del plan Hobby de Vercel.
const rutas = { conectar, callback };

export default function handler(req, res) {
  const fn = rutas[req.query.action];
  if (!fn) {
    return res.status(404).json({ error: 'Ruta de ml no encontrada' });
  }
  return fn(req, res);
}
