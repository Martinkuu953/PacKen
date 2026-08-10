import { useMemo, useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { useCatalogos } from '../hooks/useCatalogos';
import { ESTADOS, canonizarEstado } from '../utils/estados';
import FiltrosPaquetes from '../components/FiltrosPaquetes';

const FILTROS_VACIOS = { sellerId: '', transportistaId: '', estado: '', desde: '', hasta: '' };

const SIN_ZONA = 'Sin zona';

const COLUMNAS_ESTADO = [
  { estado: ESTADOS.INGRESADO, label: 'Ingresados', color: 'text-blue-500' },
  { estado: ESTADOS.EN_CAMINO, label: 'En camino', color: 'text-yellow-600' },
  { estado: ESTADOS.ENTREGADO, label: 'Entregados', color: 'text-green-500' },
  { estado: ESTADOS.REPROGRAMADO, label: 'Reprogramados', color: 'text-orange-500' },
  { estado: ESTADOS.CANCELADO, label: 'Cancelados', color: 'text-gray-500' },
];

const DEMORADOS = [ESTADOS.ATRASADO, ESTADOS.DEMORADO];

function agruparPorZona(paquetes) {
  const porZona = new Map();

  for (const paquete of paquetes) {
    const zona = paquete.zona || SIN_ZONA;
    if (!porZona.has(zona)) porZona.set(zona, { zona, total: 0, demorados: 0 });
    const fila = porZona.get(zona);
    fila.total += 1;

    const estado = canonizarEstado(paquete.estado);
    if (DEMORADOS.includes(estado)) fila.demorados += 1;
    if (estado) fila[estado] = (fila[estado] ?? 0) + 1;
  }

  return [...porZona.values()].sort((a, b) => b.total - a.total);
}

const Estadisticas = () => {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const { paquetes, loading, error } = usePaquetes(filtros);
  const { sellers, transportistas } = useCatalogos();

  const filas = useMemo(() => agruparPorZona(paquetes), [paquetes]);

  const totales = useMemo(
    () =>
      filas.reduce(
        (acc, fila) => {
          acc.total += fila.total;
          acc.demorados += fila.demorados;
          for (const { estado } of COLUMNAS_ESTADO) acc[estado] = (acc[estado] ?? 0) + (fila[estado] ?? 0);
          return acc;
        },
        { total: 0, demorados: 0 },
      ),
    [filas],
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Estadísticas por zona</h2>
          <span className="text-xs sm:text-sm text-gray-500">
            {loading ? 'Cargando...' : `${totales.total} envíos`}
          </span>
        </div>

        <FiltrosPaquetes
          valores={filtros}
          onChange={setFiltros}
          sellers={sellers}
          transportistas={transportistas}
        />

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">Zona</th>
                <th className="py-2 px-2">Total</th>
                {COLUMNAS_ESTADO.map((col) => (
                  <th key={col.estado} className="py-2 px-2 whitespace-nowrap">{col.label}</th>
                ))}
                <th className="py-2 px-2">Demorados</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNAS_ESTADO.length + 3} className="py-6 px-2 text-center text-gray-500">
                    Cargando estadísticas...
                  </td>
                </tr>
              )}
              {!loading && filas.length === 0 && !error && (
                <tr>
                  <td colSpan={COLUMNAS_ESTADO.length + 3} className="py-6 px-2 text-center text-gray-500">
                    No hay paquetes para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {!loading &&
                filas.map((fila) => (
                  <tr key={fila.zona} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-800">{fila.zona}</td>
                    <td className="py-2 px-2 font-semibold text-gray-700">{fila.total}</td>
                    {COLUMNAS_ESTADO.map((col) => (
                      <td key={col.estado} className={`py-2 px-2 font-medium ${col.color}`}>
                        {fila[col.estado] ?? 0}
                      </td>
                    ))}
                    <td className="py-2 px-2 font-medium text-red-500">{fila.demorados}</td>
                  </tr>
                ))}
            </tbody>
            {!loading && filas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-bold text-gray-800">
                  <td className="py-2 px-2">Total</td>
                  <td className="py-2 px-2">{totales.total}</td>
                  {COLUMNAS_ESTADO.map((col) => (
                    <td key={col.estado} className="py-2 px-2">{totales[col.estado] ?? 0}</td>
                  ))}
                  <td className="py-2 px-2">{totales.demorados}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default Estadisticas;
