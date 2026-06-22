import { apiFetch, setToken } from './api';

// Login de seller o transportista. Guarda el token y devuelve el usuario.
export async function login(identificador, contrasena) {
  const { token, usuario } = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identificador, contrasena }),
  });
  setToken(token);
  return usuario;
}

// Auto-registro de un seller.
export async function registrarSeller(datos) {
  const { token, usuario } = await apiFetch('/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  setToken(token);
  return usuario;
}

// Alta de un transportista hecha por un seller logueado.
export async function crearTransportista(datos) {
  const { transportista } = await apiFetch('/api/auth/transportistas', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return transportista;
}

// Devuelve el usuario actual a partir del token guardado.
export async function obtenerUsuarioActual() {
  const { usuario } = await apiFetch('/api/auth/me');
  return usuario;
}

export function logout() {
  setToken(null);
}
