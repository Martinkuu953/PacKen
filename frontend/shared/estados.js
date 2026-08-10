// Fuente única de verdad del estado de un paquete.
// Lo importan tanto el cliente (src/) como las Serverless Functions (api/):
// tener la lista duplicada en ambos lados fue la causa de que un estado válido
// en un backend fuera rechazado por el otro.

export const ESTADOS = {
  INGRESADO: 'Ingresado',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  REPROGRAMADO: 'Reprogramado',
  ATRASADO: 'Atrasado',
  DEMORADO: 'Demorado',
};

export const ESTADOS_VALIDOS = Object.values(ESTADOS);

// Los datos históricos tienen variantes de grafía ("EN CAMINO", "en_camino",
// "En Camino "). Se comparan por raíz sin acentos para que un paquete migrado
// desde otra base siga cayendo en el estado correcto.
const RAICES = [
  [ESTADOS.ATRASADO, ['atrasad']],
  [ESTADOS.DEMORADO, ['demorad']],
  [ESTADOS.CANCELADO, ['cancel']],
  [ESTADOS.ENTREGADO, ['entregad']],
  [ESTADOS.REPROGRAMADO, ['reprogram']],
  [ESTADOS.EN_CAMINO, ['camino', 'transito', 'reparto']],
  [ESTADOS.INGRESADO, ['ingresad', 'colecta', 'pendiente']],
];

export function normalizarEstado(estado) {
  return String(estado ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Devuelve el estado canónico correspondiente, o null si no se reconoce.
export function canonizarEstado(estado) {
  const e = normalizarEstado(estado);
  if (!e) return null;
  const exacto = ESTADOS_VALIDOS.find((v) => normalizarEstado(v) === e);
  if (exacto) return exacto;
  const porRaiz = RAICES.find(([, raices]) => raices.some((r) => e.includes(r)));
  return porRaiz ? porRaiz[0] : null;
}

export function esEstadoValido(estado) {
  return canonizarEstado(estado) !== null;
}

const COLORES = {
  [ESTADOS.ATRASADO]: 'text-red-500',
  [ESTADOS.DEMORADO]: 'text-red-500',
  [ESTADOS.CANCELADO]: 'text-red-500',
  [ESTADOS.ENTREGADO]: 'text-green-500',
  [ESTADOS.REPROGRAMADO]: 'text-orange-500',
  [ESTADOS.EN_CAMINO]: 'text-yellow-600',
  [ESTADOS.INGRESADO]: 'text-blue-500',
};

export function colorEstado(estado) {
  return COLORES[canonizarEstado(estado)] ?? 'text-gray-500';
}

// Menor número = más urgente → aparece primero al ordenar por estado.
const PRIORIDADES = {
  [ESTADOS.ATRASADO]: 1,
  [ESTADOS.DEMORADO]: 1,
  [ESTADOS.REPROGRAMADO]: 2,
  [ESTADOS.EN_CAMINO]: 3,
  [ESTADOS.INGRESADO]: 4,
  [ESTADOS.ENTREGADO]: 5,
  [ESTADOS.CANCELADO]: 6,
};

export function prioridadEstado(estado) {
  return PRIORIDADES[canonizarEstado(estado)] ?? 7;
}
