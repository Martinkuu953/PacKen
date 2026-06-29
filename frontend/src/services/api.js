const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${route}` : route;
}

function getStoredToken() {
  return localStorage.getItem('packen_token');
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.includes('/api/auth/')) {
    localStorage.removeItem('packen_token');
    localStorage.removeItem('packen_usuario');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    throw new Error(body.error || body.message || `Error ${res.status}`);
  }

  return body;
}
