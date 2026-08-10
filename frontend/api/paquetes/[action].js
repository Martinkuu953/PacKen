import cambiarEstado from '../_lib/paquetes/cambiar-estado.js';
import escanear from '../_lib/paquetes/escanear.js';
import reasignar from '../_lib/paquetes/reasignar.js';
import simularEntregas from '../_lib/paquetes/simular-entregas.js';

// Dispatcher único para /api/paquetes/<action> — consolida 3 rutas en una
// sola Serverless Function (mismo patrón que /api/auth), para hacer lugar a
// /api/ml sin pasarnos del límite de 12 del plan Hobby de Vercel.
// /api/paquetes (sin action) sigue resolviendo aparte en paquetes/index.js.
const rutas = {
  'cambiar-estado': cambiarEstado,
  escanear,
  reasignar,
  'simular-entregas': simularEntregas,
};

export default function handler(req, res) {
  const fn = rutas[req.query.action];
  if (!fn) {
    return res.status(404).json({ error: 'Ruta de paquetes no encontrada' });
  }
  return fn(req, res);
}
