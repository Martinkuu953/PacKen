// Helpers compartidos para los buscadores de las tablas.

// Rango de marcas diacríticas combinantes que deja NFD al descomponer.
const ACENTOS = /[̀-ͯ]/g;

// Normaliza para comparar: sin acentos y en minúsculas, así "Martín" matchea
// escribiendo "martin" (y al revés).
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(ACENTOS, '')
    .toLowerCase()
    .trim();
}

// Filtra por coincidencia parcial en cualquiera de los campos indicados.
// Cada palabra del término debe aparecer en algún campo, así "baby 40" o
// "40 baby" encuentran lo mismo.
export function filtrarPorTexto(items, texto, campos) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return items;

  return items.filter((item) => {
    const contenido = campos.map((campo) => normalizar(item[campo])).join(' ');
    return palabras.every((palabra) => contenido.includes(palabra));
  });
}
