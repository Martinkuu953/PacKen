import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { query, dbConfigurado } from '../src/lib/db.js';
import { pedirTokenPorCodigo, obtenerUsuarioML, nombreDesdeUsuarioML, guardarSellerYToken, enmascarar } from './lib/ml-oauth.mjs';

// ──────────────────────────────────────────────────────────────────────────
// Uso:
//   node scripts/conectar-seller.mjs
//
// Conecta un seller nuevo (o reconecta uno viejo) sin tener que armar la URL
// de autorización a mano ni copiar/pegar tokens: abre el navegador, el
// dueño de la cuenta de ML aprueba el acceso, y el script levanta un
// servidor local para recibir el código, canjearlo por los tokens, leer el
// nombre real del vendedor y guardar todo en la base.
//
// Requiere que ML_REDIRECT_URI (backend/.env) esté cargada TAL CUAL en tu
// app de Mercado Libre → Mis aplicaciones → editar → "URIs de redirect".
// Ejemplo: http://localhost:8934/callback
// ──────────────────────────────────────────────────────────────────────────

const idEmpresa = 1; // empresa por defecto (existe en la DB), igual que registrar-seller.mjs

const ML_CLIENT_ID = process.env.ML_CLIENT_ID || process.env.VITE_ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET || process.env.VITE_ML_CLIENT_SECRET;
const REDIRECT_URI = process.env.ML_REDIRECT_URI;
// Dominio de autorización según el país de la cuenta de ML (por defecto Argentina).
const ML_AUTH_DOMAIN = process.env.ML_AUTH_DOMAIN || 'auth.mercadolibre.com.ar';

if (!dbConfigurado()) {
  console.error('❌ DATABASE_URL no configurado en backend/.env');
  process.exit(1);
}

if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
  console.error('❌ Falta el client_id o client_secret de la app de ML.');
  console.error('   Agregá ML_CLIENT_ID y ML_CLIENT_SECRET (o VITE_ML_CLIENT_ID / VITE_ML_CLIENT_SECRET) en backend/.env');
  process.exit(1);
}

if (!REDIRECT_URI) {
  console.error('❌ Falta ML_REDIRECT_URI en backend/.env.');
  console.error('   Tiene que ser EXACTAMENTE la misma URL que registraste en tu app de ML');
  console.error('   (Mis aplicaciones → tu app → editar → "URIs de redirect").');
  console.error('   Ejemplo: ML_REDIRECT_URI=http://localhost:8934/callback');
  process.exit(1);
}

function abrirNavegador(url) {
  const comando =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(comando, (err) => {
    if (err) {
      console.log('⚠️  No pude abrir el navegador solo. Entrá a mano a:');
      console.log(`   ${url}`);
    }
  });
}

// Levanta un servidor HTTP efímero en el puerto de ML_REDIRECT_URI, abre el
// navegador con la URL de autorización, y devuelve el "code" que ML manda
// de vuelta. Rechaza si el usuario cancela o si el "state" no coincide
// (protección contra CSRF: alguien mandándonos un código que no pedimos).
function pedirAutorizacion() {
  const { port, pathname } = new URL(REDIRECT_URI);
  const state = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== pathname) {
        res.writeHead(404).end();
        return;
      }

      const params = url.searchParams;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

      if (params.get('error')) {
        res.end('<h2>❌ Autorización rechazada. Podés cerrar esta pestaña.</h2>');
        server.close();
        reject(new Error(`ML devolvió error: ${params.get('error')} — ${params.get('error_description') || ''}`));
        return;
      }

      if (params.get('state') !== state) {
        res.end('<h2>❌ Respuesta inválida (state no coincide). Cerrá esta pestaña y reintentá.</h2>');
        server.close();
        reject(new Error('El "state" devuelto por ML no coincide con el que mandamos'));
        return;
      }

      res.end('<h2>✅ Listo, ya podés cerrar esta pestaña.</h2>');
      server.close();
      resolve(params.get('code'));
    });

    server.listen(Number(port) || 80, () => {
      const authUrl = new URL(`https://${ML_AUTH_DOMAIN}/authorization`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', ML_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('state', state);

      console.log('🌐 Abriendo el navegador para que el vendedor apruebe el acceso...');
      console.log(`   Si no se abre solo, entrá a:\n   ${authUrl.toString()}`);
      abrirNavegador(authUrl.toString());
    });
  });
}

// ── 1) Login del seller en ML + código de autorización ────────────────────
const code = await pedirAutorizacion();

// ── 2) Canjear el código por los tokens ────────────────────────────────────
console.log('🔄 Canjeando el código por los tokens...');
const tokenData = await pedirTokenPorCodigo({
  clientId: ML_CLIENT_ID,
  clientSecret: ML_CLIENT_SECRET,
  code,
  redirectUri: REDIRECT_URI,
});

console.log('🔑 access_token   :', enmascarar(tokenData.access_token));
console.log('🔁 refresh_token  :', enmascarar(tokenData.refresh_token));

// ── 3) Datos reales del vendedor (id de ML + nombre) ───────────────────────
console.log('👤 Pidiendo datos del vendedor a MercadoLibre...');
const usuarioML = await obtenerUsuarioML(tokenData.access_token);
const nombre = nombreDesdeUsuarioML(usuarioML, `Seller ${usuarioML.id}`);
console.log(`📛 Vendedor: ${nombre} (idmercadolibre=${usuarioML.id})`);

// ── 4) Guardar seller + token ──────────────────────────────────────────────
const { idSellerInterno, yaExistia } = await guardarSellerYToken(query, {
  idEmpresa,
  idMercadoLibre: usuarioML.id,
  nombre,
  accessToken: tokenData.access_token,
  refreshToken: tokenData.refresh_token,
  expiresIn: tokenData.expires_in,
});

console.log(
  yaExistia
    ? `✅ Seller reconectado (id interno=${idSellerInterno})`
    : `🆕 Seller creado (id interno=${idSellerInterno})`,
);
console.log(`\n✅ Listo. Ya podés escanear paquetes de "${nombre}"`);

process.exit(0);
