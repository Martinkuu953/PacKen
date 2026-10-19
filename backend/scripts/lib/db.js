import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getConnectionString() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    null
  );
}

export function dbConfigurado() {
  return Boolean(getConnectionString());
}

export function getPool() {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) return null;

  // rejectUnauthorized: true valida el certificado del servidor. Con
  // `false` cualquiera que se meta en el medio de la conexión puede hacerse
  // pasar por la base sin que nos enteremos. Supabase presenta un certificado
  // válido de una CA pública, así que no hace falta cargar un CA propio.
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 10,
  });

  pool.on('error', (err) => {
    console.error('[PacKen] Error inesperado en el pool de PostgreSQL:', err.message);
  });

  return pool;
}

export async function query(text, params = []) {
  const p = getPool();
  if (!p) {
    throw new Error('DATABASE_URL no configurado en backend/.env');
  }
  return p.query(text, params);
}

export async function probarConexionDb() {
  if (!dbConfigurado()) {
    return { ok: false, error: 'DATABASE_URL no configurado' };
  }

  try {
    const { rows } = await query('SELECT 1 AS ok');
    return { ok: true, result: rows[0] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
