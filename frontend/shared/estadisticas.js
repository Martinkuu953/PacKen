// Agrupación de paquetes por partido para la pantalla de Estadísticas.
// La usan el cliente (la tabla) y /api/paquetes (el Excel): así lo que se
// descarga coincide siempre con lo que se ve en pantalla.

import { ESTADOS, canonizarEstado } from './estados.js';

export const SIN_PARTIDO = 'Sin partido';

export const COLUMNAS_ESTADO = [
  { estado: ESTADOS.INGRESADO, label: 'Ingresados' },
  { estado: ESTADOS.EN_CAMINO, label: 'En camino' },
  { estado: ESTADOS.ENTREGADO, label: 'Entregados' },
  { estado: ESTADOS.REPROGRAMADO, label: 'Reprogramados' },
  { estado: ESTADOS.CANCELADO, label: 'Cancelados' },
];

// Recibe paquetes ya mapeados (con `partido` como nombre) y devuelve una fila
// por partido, de mayor a menor cantidad, más la fila de totales.
export function agruparPorPartido(paquetes) {
  const porPartido = new Map();
  const totales = { total: 0 };

  for (const paquete of paquetes) {
    const partido = paquete.partido || SIN_PARTIDO;
    if (!porPartido.has(partido)) porPartido.set(partido, { partido, total: 0 });
    const fila = porPartido.get(partido);
    fila.total += 1;
    totales.total += 1;

    const estado = canonizarEstado(paquete.estado);
    if (estado) {
      fila[estado] = (fila[estado] ?? 0) + 1;
      totales[estado] = (totales[estado] ?? 0) + 1;
    }
  }

  const filas = [...porPartido.values()].sort(
    (a, b) => b.total - a.total || a.partido.localeCompare(b.partido, 'es'),
  );
  return { filas, totales };
}
