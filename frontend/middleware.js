import { jwtVerify } from 'jose';

// Edge Middleware de Vercel: corre antes de TODAS las requests a /api/*.
// Toda ruta es autenticada por defecto; solo pasan sin token las de la
// allowlist. Las funciones igual re-validan el token (defensa en capas).
export const config = { matcher: '/api/:path*' };

const RUTAS_PUBLICAS = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/registro' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'POST', path: '/api/auth/logout' },
  // Lo llama MercadoLibre desde afuera; GET responde el healthcheck del webhook.
  // "Pública" solo para el edge: el handler exige el secreto compartido
  // (ML_WEBHOOK_SECRET) y valida application_id/user_id.
  { method: 'POST', path: '/api/webhooks/mercadolibre' },
  { method: 'GET', path: '/api/webhooks/mercadolibre' },
  // Lo llama el cron de Supabase (pg_cron), que no tiene sesión de usuario.
  // "Pública" acá solo significa que se saltea el JWT del edge: el handler
  // exige el header x-cron-secret o, si no viene, una sesión de empresa.
  { method: 'POST', path: '/api/paquetes/sincronizar' },
  // N-01: a esta URL vuelve el navegador desde mercadolibre.com después de que
  // el seller autoriza. Es una navegación, no un fetch: no lleva header
  // Authorization. La empresa sale del "state" firmado (y de corta vida) que
  // armó /api/ml/conectar, y el handler lo valida.
  { method: 'GET', path: '/api/ml/callback' },
];

function respuesta401(error) {
  return new Response(JSON.stringify({ error }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function middleware(req) {
  const { pathname } = new URL(req.url);

  const esPublica = RUTAS_PUBLICAS.some(
    (ruta) => ruta.method === req.method && ruta.path === pathname,
  );
  if (esPublica) return;

  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return respuesta401('Token requerido');
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(header.slice(7), secret);
    // Solo un access token trae sub. Otros JWT firmados con el mismo secreto
    // (el state de OAuth de ML) no sirven como sesión.
    if (!payload.sub) throw new Error('sin sub');
  } catch {
    return respuesta401('Token inválido o expirado');
  }
}
