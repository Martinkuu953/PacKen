import app from './app.js';

// Servidor local (desarrollo). En Vercel se usa api/ en lugar de este listen.
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[PacKen] API en http://localhost:${PORT}`);
});
