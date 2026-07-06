const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${route}` : route;
}

function getStoredToken() {
  return localStorage.getItem('packen_token');
}

let syncHandlers = { onTokenRefreshed: null, onSessionExpired: null };

export function setAuthSyncHandlers(handlers) {
  syncHandlers = { ...syncHandlers, ...handlers };
}

let refreshPromise = null;

function intentarRefresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'No se pudo refrescar la sesión');
        return body;
      })
      .finally(() => {
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

async function ejecutarFetch(path, options, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export async function apiFetch(path, options = {}) {
  const { res, body } = await ejecutarFetch(path, options, getStoredToken());

  if (res.status === 401 && !esRutaAuthPublica(path)) {
    try {
      const refreshed = await intentarRefresh();
      syncHandlers.onTokenRefreshed?.(refreshed.token, refreshed.usuario);
      const reintento = await ejecutarFetch(path, options, refreshed.token);
      if (!reintento.res.ok) {
        throw new Error(reintento.body.error || reintento.body.message || `Error ${reintento.res.status}`);
      }
      return reintento.body;
    } catch {
      syncHandlers.onSessionExpired?.();
      localStorage.removeItem('packen_token');
      localStorage.removeItem('packen_usuario');
      window.location.href = '/login';
      throw new Error('Sesión expirada');
    }
  }

  if (!res.ok) {
    throw new Error(body.error || body.message || `Error ${res.status}`);
  }

  return body;
}
