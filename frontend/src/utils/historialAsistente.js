// Historial del asistente guiado en sessionStorage (ver Asistente.jsx). Vive
// acá y no en el componente para que AuthContext lo pueda borrar al cerrar
// sesión sin importar el componente.

export const PREFIJO_HISTORIAL = 'packen_asistente';

export function borrarHistorialAsistente() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIJO_HISTORIAL))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Storage bloqueado: no hay nada guardado que borrar.
  }
}
