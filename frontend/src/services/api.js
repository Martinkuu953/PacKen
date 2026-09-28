const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${route}` : route;
}

// A-03: el access token vive solo en memoria (esta variable), nunca en
// localStorage. Un XSS ya no puede leerlo de ahí, y al recargar la página se
// pierde: la sesión se rehidrata con el refresh token de la cookie httpOnly.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token ?? null;
}

// Restos de versiones viejas que sí guardaban la sesión en localStorage.
try {
  localStorage.removeItem('packen_token');
  localStorage.removeItem('packen_usuario');
} catch {
  // modo privado / storage bloqueado: no hay nada que limpiar
}

let syncHandlers = { onTokenRefreshed: null, onSessionExpired: null };

export function setAuthSyncHandlers(handlers) {
  syncHandlers = { ...syncHandlers, ...handlers };
}

let refreshPromise = null;

// Una sola petición de refresh en vuelo a la vez: si tres requests se topan
// con un 401 al mismo tiempo, comparten la misma rotación en lugar de rotar
// el token tres veces (lo que dispararía la detección de reuso).
//
// Entre pestañas pasa lo mismo: cada una tiene su token en memoria y todas
// comparten la cookie. Si dos rotaran a la vez con la misma cookie, la segunda
// usaría un token ya rotado y el servidor lo tomaría como robo (revoca todo).
// El Web Lock las pone en fila: la segunda sale con la cookie ya rotada.
function pedirRefresh() {
  return fetch(apiUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'No se pudo refrescar la sesión');
    accessToken = body.token;
    return body;
  });
}

export function intentarRefresh() {
  if (!refreshPromise) {
    const conLock = typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('packen-refresh', pedirRefresh)
      : pedirRefresh();
    refreshPromise = conLock.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function esRutaAuthPublica(path) {
  return (
    path.includes('/api/auth/login') ||
    path.includes('/api/auth/registro') ||
    path.includes('/api/auth/refresh')
  );
}

function ejecutarFetch(path, options, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
}

// Hace la request y, si el access token venció, la reintenta una sola vez con
// el token rotado. Devuelve la Response cruda: quien llama decide si el cuerpo
// es JSON o un archivo.
async function fetchConSesion(path, options) {
  const res = await ejecutarFetch(path, options, accessToken);
  if (res.status !== 401 || esRutaAuthPublica(path)) return res;

  let refreshed;
  try {
    refreshed = await intentarRefresh();
  } catch {
    accessToken = null;
    syncHandlers.onSessionExpired?.();
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  syncHandlers.onTokenRefreshed?.(refreshed.token, refreshed.usuario);
  return ejecutarFetch(path, options, refreshed.token);
}

export async function apiFetch(path, options = {}) {
  const res = await fetchConSesion(path, options);
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error || body.message || `Error ${res.status}`);
  }

  return body;
}

// Descarga un archivo de la API y dispara el "guardar como" del navegador.
// No alcanza con un <a href>: el middleware exige el header Authorization en
// toda ruta de /api, y un link no lo manda.
export async function apiDescargar(path, nombreArchivo) {
  const res = await fetchConSesion(path, { method: 'GET' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Error ${res.status}`);
  }

  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
