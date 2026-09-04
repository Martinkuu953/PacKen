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
  { method: 'POST', path: '/api/webhooks/mercadolibre' },
  { method: 'GET', path: '/api/webhooks/mercadolibre' },
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
    await jwtVerify(header.slice(7), secret);
  } catch {
    return respuesta401('Token inválido o expirado');
  }
}
