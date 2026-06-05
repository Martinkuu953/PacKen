import { apiFetch } from './api.js';

export async function getPaquetes() {
  return apiFetch('/api/paquetes');
}
