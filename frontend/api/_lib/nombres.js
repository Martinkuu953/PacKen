// Comparación de nombres "a la vista del usuario": sin mayúsculas, sin tildes
// y sin espacios de más. Para el que mira un selector, "Zona Norte" y
// "zona  norte" son el mismo nombre, así que no pueden convivir dos.

export function limpiarNombre(nombre) {
  return String(nombre ?? '').trim().replace(/\s+/g, ' ');
}

export function claveNombre(nombre) {
  return limpiarNombre(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// filas: [{ id, nombre }]. excluirId deja afuera la propia fila al renombrar.
export function nombreRepetido(filas, nombre, excluirId = null) {
  const clave = claveNombre(nombre);
  return (filas ?? []).some((f) => f.id !== excluirId && claveNombre(f.nombre) === clave);
}
