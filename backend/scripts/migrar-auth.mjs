import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, dbConfigurado } from '../src/lib/db.js';

// ──────────────────────────────────────────────────────────────────────────
// Migración de autenticación:
//   1) Agrega las columnas de credenciales que le faltan al `seller`.
//   2) Hashea (bcrypt) las contraseñas que todavía estén en texto plano
//      en `seller`, `transportista` y `empresa`.
//
// Es idempotente: se puede correr varias veces sin romper nada.
//   Uso: node scripts/migrar-auth.mjs
// ──────────────────────────────────────────────────────────────────────────

if (!dbConfigurado()) {
  console.error('❌ DATABASE_URL no configurado en backend/.env');
  process.exit(1);
}

// Un hash bcrypt siempre empieza con $2a$ / $2b$ / $2y$ y mide 60 chars.
function yaEsHash(valor) {
  return typeof valor === 'string' && /^\$2[aby]\$\d{2}\$/.test(valor);
}

// ── 1) Columnas nuevas en seller ──────────────────────────────────────────
console.log('🛠  Agregando columnas de credenciales a seller (si faltan)...');
await query(`
  ALTER TABLE seller
    ADD COLUMN IF NOT EXISTS correoelectronico text,
    ADD COLUMN IF NOT EXISTS telefono text,
    ADD COLUMN IF NOT EXISTS contrasena text
`);

// Índice único por email para que no haya dos sellers con el mismo correo.
await query(`
  CREATE UNIQUE INDEX IF NOT EXISTS seller_correo_unico
    ON seller (lower(correoelectronico))
    WHERE correoelectronico IS NOT NULL
`);

// Un seller puede registrarse ANTES de vincular MercadoLibre, así que
// idmercadolibre deja de ser obligatorio.
await query('ALTER TABLE seller ALTER COLUMN idmercadolibre DROP NOT NULL');
console.log('✅ Columnas, índice y constraints listos.');

// Resincronizar las secuencias de id (filas cargadas a mano dejan el sequence
// atrás y los INSERT nuevos chocan con ids existentes).
for (const tabla of ['seller', 'transportista', 'empresa']) {
  await query(
    `SELECT setval(
       pg_get_serial_sequence('${tabla}', 'id'),
       GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${tabla}), 1)
     )`,
  );
}
console.log('✅ Secuencias de id resincronizadas.');

// ── 2) Hashear contraseñas en texto plano ─────────────────────────────────
const tablas = ['seller', 'transportista', 'empresa'];
for (const tabla of tablas) {
  const { rows } = await query(
    `SELECT id, contrasena FROM ${tabla} WHERE contrasena IS NOT NULL AND contrasena <> ''`,
  );
  let migradas = 0;
  for (const fila of rows) {
    if (yaEsHash(fila.contrasena)) continue;
    const hash = await bcrypt.hash(fila.contrasena, 10);
    await query(`UPDATE ${tabla} SET contrasena = $1 WHERE id = $2`, [hash, fila.id]);
    migradas += 1;
  }
  console.log(`🔐 ${tabla}: ${migradas} contraseña(s) hasheada(s) (${rows.length} con contraseña).`);
}

console.log('\n✅ Migración de auth completada.');
process.exit(0);
