import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import empresasRouter from './routes/empresas.js';
import enviosRouter from './routes/envios.js';
import paquetesRouter from './routes/paquetes.js';
import solicitudesRouter from './routes/solicitudes.js';
import preciosRouter from './routes/precios.js';
import costosRouter from './routes/costos.js';
import { probarConexionDb } from './lib/db.js';
import { autenticar, requiereRol } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const RUTAS_PUBLICAS = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/registro' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET', path: '/api/empresas' },
];

function esRutaPublica(req) {
  const path = req.originalUrl.split('?')[0];
  return RUTAS_PUBLICAS.some(
    (ruta) => ruta.method === req.method && path === ruta.path,
  );
}

app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'packen-backend' });
});

app.get('/health/db', async (_req, res) => {
  const resultado = await probarConexionDb();
  res.status(resultado.ok ? 200 : 503).json(resultado);
});

app.use('/api', (req, res, next) => {
  if (esRutaPublica(req)) return next();
  return autenticar(req, res, next);
});

app.use('/api/auth', authRouter);
app.use('/api/empresas', empresasRouter);
app.use('/api/envios', requiereRol('empresa'), enviosRouter);
app.use('/api/paquetes', paquetesRouter);
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/precios', preciosRouter);
app.use('/api/costos', costosRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[PacKen] API en http://localhost:${PORT}`);
});