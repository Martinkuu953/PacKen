import { supabase } from './supabase.js';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, '');
  const route = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${route}` : route;
}

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (!headers.Authorization && !headers.authorization && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  const res = await fetch(apiUrl(path), { ...options, headers });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.error || body.message || `Error ${res.status}`);
  }

  return body;
}
