// Helpers compartidos para trabajar con el "estado" de un paquete.

export function normalizarEstado(estado) {
  return String(estado ?? '').toLowerCase().trim();
}

// Color del texto según el estado (clases de Tailwind).
export function colorEstado(estado) {
  const e = normalizarEstado(estado);
  if (e.includes('atrasad') || e.includes('demorad')) return 'text-red-500';
  if (e.includes('cancel')) return 'text-red-500';
  if (e.includes('entregad')) return 'text-green-500';
  if (e.includes('reprogram')) return 'text-orange-500';
  if (e.includes('camino')) return 'text-yellow-600';
  if (e.includes('ingresad')) return 'text-blue-500';
  return 'text-gray-500';
}

// Prioridad para ordenar "por lo más importante".
// Menor número = más urgente → aparece primero.
export function prioridadEstado(estado) {
  const e = normalizarEstado(estado);
  if (e.includes('atrasad') || e.includes('demorad')) return 1;
  if (e.includes('reprogram')) return 2;
  if (e.includes('camino')) return 3;
  if (e.includes('ingresad')) return 4;
  if (e.includes('entregad')) return 5;
  if (e.includes('cancel')) return 6;
  return 7;
}
