import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import enviosRouter from './routes/envios.js';
import paquetesRouter from './routes/paquetes.js';
import { probarConexionDb } from './lib/db.js';

// App de Express configurada, SIN escuchar puerto. La usan tanto el servidor
// local (index.js) como la Vercel Serverless Function (api/).
const app = express();

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
app.use('/api/envios', enviosRouter);
app.use('/api/paquetes', paquetesRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
