const API_BASE = import.meta.env.VITE_API_URL ?? '';

const TOKEN_KEY = 'packen_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${route}` : route;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error || body.message || `Error ${res.status}`);
  }

  return body;
}
