import 'dotenv/config';
import { query, dbConfigurado } from '../src/lib/db.js';
import { pedirTokenPorRefresh, obtenerUsuarioML, nombreDesdeUsuarioML, guardarSellerYToken, enmascarar } from './lib/ml-oauth.mjs';

// ──────────────────────────────────────────────────────────────────────────
// Uso:
//   node scripts/registrar-seller.mjs <idMercadoLibre> <refreshToken> [nombre]
//
// Para cuando YA tenés un refresh_token del seller (por ejemplo, uno viejo
// guardado a mano). Si no tenés ninguno todavía, usá conectar-seller.mjs:
// te lleva por el login de ML y consigue el primero solo.
//
// Crea (si no existe) el seller en la tabla `seller`, pide un access_token
// fresco a MercadoLibre usando el refresh_token, y lo guarda en `meli_token`.
// ──────────────────────────────────────────────────────────────────────────

const [, , sellerIdArg, refreshTokenArg, nombreArg] = process.argv;

const sellerId = sellerIdArg;
// refresh_token: arg de CLI, si no, el de .env
const refreshToken = refreshTokenArg || process.env.VITE_ML_REFRESH_TOKEN;
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

// ── 1) Pedir access_token a ML (lo necesitamos para leer el nombre real) ──
console.log('🔄 Pidiendo access_token a MercadoLibre...');
const tokenData = await pedirTokenPorRefresh({
  clientId: ML_CLIENT_ID,
  clientSecret: ML_CLIENT_SECRET,
  refreshToken,
});
const accessToken = tokenData.access_token;
const nuevoRefreshToken = tokenData.refresh_token || refreshToken;

console.log('🔑 access_token   :', enmascarar(accessToken));
console.log('🔁 refresh_token  :', enmascarar(nuevoRefreshToken));

// ── 2) Nombre del seller: el que se pasó a mano, o el real de ML ──────────
console.log('👤 Pidiendo datos del vendedor a MercadoLibre...');
const usuarioML = await obtenerUsuarioML(accessToken);
const nombre = nombreArg || nombreDesdeUsuarioML(usuarioML, `Seller ${sellerId}`);
console.log(`📛 Nombre: ${nombre}${nombreArg ? ' (a mano)' : ' (desde ML)'}`);

// ── 3) Guardar seller + token ──────────────────────────────────────────────
const { idSellerInterno, yaExistia } = await guardarSellerYToken(query, {
  idEmpresa,
  idMercadoLibre: sellerId,
  nombre,
  accessToken,
  refreshToken: nuevoRefreshToken,
  expiresIn: tokenData.expires_in,
});

console.log(
  yaExistia
    ? `✅ Seller ya existía: idmercadolibre=${sellerId} → id interno=${idSellerInterno} (nombre actualizado)`
    : `🆕 Seller creado: idmercadolibre=${sellerId} → id interno=${idSellerInterno}`,
);
console.log('\n✅ Listo. Ya podés escanear paquetes del seller', sellerId);

process.exit(0);
