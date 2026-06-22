import 'dotenv/config';
import { query, dbConfigurado } from '../src/lib/db.js';

// ──────────────────────────────────────────────────────────────────────────
// Uso:
//   node scripts/registrar-seller.mjs <idMercadoLibre> <refreshToken> [nombre]
//
// Crea (si no existe) el seller en la tabla `seller`, pide un access_token
// fresco a MercadoLibre usando el refresh_token, y lo guarda en `meli_token`.
// ──────────────────────────────────────────────────────────────────────────

const ML_API = 'https://api.mercadolibre.com';

const [, , sellerIdArg, refreshTokenArg, nombreArg] = process.argv;

const sellerId = sellerIdArg;
// refresh_token: arg de CLI, si no, el de .env
const refreshToken = refreshTokenArg || process.env.VITE_ML_REFRESH_TOKEN;
const nombre = nombreArg || `Seller ${sellerId}`;
const idEmpresa = 1; // empresa por defecto (existe en la DB)

// Credenciales de la app de ML (acepta nombres con o sin prefijo VITE_)
const ML_CLIENT_ID = process.env.ML_CLIENT_ID || process.env.VITE_ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET || process.env.VITE_ML_CLIENT_SECRET;

if (!sellerId || !refreshToken) {
  console.error('❌ Uso: node scripts/registrar-seller.mjs <idMercadoLibre> <refreshToken> [nombre]');
  console.error('   (el refreshToken también se toma de VITE_ML_REFRESH_TOKEN si no se pasa)');
  process.exit(1);
}

if (!dbConfigurado()) {
  console.error('❌ DATABASE_URL no configurado en backend/.env');
  process.exit(1);
}

if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
  console.error('❌ Falta el client_id o client_secret de la app de ML.');
  console.error('   Agregá ML_CLIENT_ID y ML_CLIENT_SECRET (o VITE_ML_CLIENT_ID / VITE_ML_CLIENT_SECRET) en backend/.env');
  console.error(`   Detectado → client_id: ${ML_CLIENT_ID ? 'OK' : 'FALTA'}, client_secret: ${ML_CLIENT_SECRET ? 'OK' : 'FALTA'}`);
  process.exit(1);
}

async function pedirRefreshAML(token) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    refresh_token: token,
  });

  console.log('🔄 Pidiendo access_token a MercadoLibre...');
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`ML OAuth error ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

function enmascarar(t) {
  if (!t) return '(vacío)';
  return `${t.slice(0, 12)}…${t.slice(-6)} (len=${t.length})`;
}

// ── 1) Asegurar que el seller exista ──────────────────────────────────────
const { rows: sellerRows } = await query(
  'SELECT id FROM seller WHERE idmercadolibre = $1 LIMIT 1',
  [String(sellerId)]
);

let idSellerInterno;
if (sellerRows.length > 0) {
  idSellerInterno = sellerRows[0].id;
  console.log(`✅ Seller ya existe: idmercadolibre=${sellerId} → id interno=${idSellerInterno}`);
} else {
  const { rows } = await query(
    `INSERT INTO seller (idempresa, nombre, idmercadolibre)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [idEmpresa, nombre, String(sellerId)]
  );
  idSellerInterno = rows[0].id;
  console.log(`🆕 Seller creado: idmercadolibre=${sellerId} → id interno=${idSellerInterno}`);
}

// ── 2) Pedir access_token a ML ────────────────────────────────────────────
const data = await pedirRefreshAML(refreshToken);
const accessToken = data.access_token;
const nuevoRefreshToken = data.refresh_token || refreshToken;
const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000);

console.log('🔑 access_token   :', enmascarar(accessToken));
console.log('🔁 refresh_token  :', enmascarar(nuevoRefreshToken));
console.log('⏰ expira         :', expiresAt.toISOString());

// ── 3) Guardar (upsert) en meli_token ─────────────────────────────────────
const { rows: tokenRows } = await query(
  'SELECT id FROM meli_token WHERE idseller = $1 LIMIT 1',
  [idSellerInterno]
);

if (tokenRows.length > 0) {
  await query(
    `UPDATE meli_token
     SET access_token = $1, refresh_token = $2, expires_at = $3, fechaactualizacion = now()
     WHERE id = $4`,
    [accessToken, nuevoRefreshToken, expiresAt, tokenRows[0].id]
  );
  console.log(`💾 Token ACTUALIZADO en meli_token (id=${tokenRows[0].id})`);
} else {
  const { rows } = await query(
    `INSERT INTO meli_token (access_token, refresh_token, expires_at, idseller)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [accessToken, nuevoRefreshToken, expiresAt, idSellerInterno]
  );
  console.log(`💾 Token INSERTADO en meli_token (id=${rows[0].id})`);
}

// ── 4) Verificación: releer de la DB ──────────────────────────────────────
const { rows: check } = await query(
  'SELECT id, idseller, expires_at, fechaactualizacion FROM meli_token WHERE idseller = $1',
  [idSellerInterno]
);
console.log('🔎 Verificación en DB:', JSON.stringify(check[0], null, 2));
console.log('\n✅ Listo. Ya podés escanear paquetes del seller', sellerId);

process.exit(0);
