import 'dotenv/config';
import { query, dbConfigurado, getPool } from './lib/db.js';
import { cifrarToken, estaCifrado } from '../../frontend/api/_lib/cifrado.js';

// ──────────────────────────────────────────────────────────────────────────
// Uso:
//   npm run tokens:cifrar -w backend
//
// Cifra de una vez los tokens de Mercado Libre que quedaron en texto plano en
// meli_token. No hace falta para que la app funcione (lee los dos formatos y
// cifra cada token al renovarlo), pero sin correrlo los tokens viejos siguen
// en plano hasta su próxima renovación.
//
// Requiere en backend/.env: DATABASE_URL y ML_TOKEN_KEY (el MISMO valor que en
// Vercel; si no coinciden, la app no va a poder leer los tokens).
// Es idempotente: las filas ya cifradas se saltean.
// ──────────────────────────────────────────────────────────────────────────

if (!dbConfigurado()) {
  console.error('❌ DATABASE_URL no configurado en backend/.env');
  process.exit(1);
}
if (!process.env.ML_TOKEN_KEY) {
  console.error('❌ ML_TOKEN_KEY no configurado en backend/.env (tiene que ser igual al de Vercel)');
  process.exit(1);
}

const { rows } = await query('SELECT id, access_token, refresh_token FROM meli_token');
let cifradas = 0;

for (const fila of rows) {
  if (estaCifrado(fila.access_token) && estaCifrado(fila.refresh_token)) continue;
  await query('UPDATE meli_token SET access_token = $1, refresh_token = $2 WHERE id = $3', [
    estaCifrado(fila.access_token) ? fila.access_token : cifrarToken(fila.access_token),
    estaCifrado(fila.refresh_token) ? fila.refresh_token : cifrarToken(fila.refresh_token),
    fila.id,
  ]);
  cifradas += 1;
}

console.log(`✅ ${cifradas} fila(s) cifradas, ${rows.length - cifradas} ya estaban cifradas.`);
await getPool()?.end();
