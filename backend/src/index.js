import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import empresasRouter from './routes/empresas.js';
import enviosRouter from './routes/envios.js';
import paquetesRouter from './routes/paquetes.js';
import solicitudesRouter from './routes/solicitudes.js';
import { probarConexionDb } from './lib/db.js';
import { autenticar, requiereRol } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:5173'],
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'packen-backend' });
});

app.get('/health/db', async (_req, res) => {
  const resultado = await probarConexionDb();
  res.status(resultado.ok ? 200 : 503).json(resultado);
});

app.use('/api/auth', authRouter);
app.use('/api/empresas', empresasRouter);
app.use('/api/envios', autenticar, requiereRol('empresa'), enviosRouter);
app.use('/api/paquetes', autenticar, paquetesRouter);
app.use('/api/solicitudes', solicitudesRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[PacKen] API en http://localhost:${PORT}`);
});