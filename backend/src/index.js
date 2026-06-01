import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import enviosRouter from './routes/envios.js';
import vendedoresRouter from './routes/vendedores.js';

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

app.use('/api/envios', enviosRouter);
app.use('/api/vendedores', vendedoresRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[PacKen] API en http://localhost:${PORT}`);
});
