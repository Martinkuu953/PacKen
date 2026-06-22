// Vercel Serverless Function: atrapa todas las rutas /api/* y las delega al
// mismo app de Express del backend (sin duplicar lógica). El app de Express es
// un handler (req, res) válido, así que Vercel lo invoca directamente.
import app from '../backend/src/app.js';

export default app;
