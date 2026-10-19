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

// Recibe conteos ya agregados [{ partido, estado, cantidad }] (lo que devuelve
// /api/paquetes?vista=estadisticas, calculado en Postgres) y devuelve una fila
// por partido, de mayor a menor cantidad, más la fila de totales.
export function agruparConteos(conteos) {
  const porPartido = new Map();
  const totales = { total: 0 };

  for (const { partido: crudo, estado: estadoCrudo, cantidad } of conteos) {
    const n = Number(cantidad) || 0;
    const partido = crudo || SIN_PARTIDO;
    if (!porPartido.has(partido)) porPartido.set(partido, { partido, total: 0 });
    const fila = porPartido.get(partido);
    fila.total += n;
    totales.total += n;

    const estado = canonizarEstado(estadoCrudo);
    if (estado) {
      fila[estado] = (fila[estado] ?? 0) + n;
      totales[estado] = (totales[estado] ?? 0) + n;
    }
  }

  const filas = [...porPartido.values()].sort(
    (a, b) => b.total - a.total || a.partido.localeCompare(b.partido, 'es'),
  );
  return { filas, totales };
}

// Lo mismo a partir de paquetes sueltos ya mapeados (con `partido` como nombre).
export function agruparPorPartido(paquetes) {
  return agruparConteos(paquetes.map((p) => ({ partido: p.partido, estado: p.estado, cantidad: 1 })));
}
