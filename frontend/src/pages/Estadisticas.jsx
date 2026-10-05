import { useMemo, useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { useCatalogos } from '../context/CatalogosContext';
import { ESTADOS } from '../utils/estados';
import { apiDescargar } from '../services/api';
import { agruparPorPartido, COLUMNAS_ESTADO as COLUMNAS } from '../../shared/estadisticas.js';
import FiltrosPaquetes from '../components/FiltrosPaquetes';

const FILTROS_VACIOS = { sellerId: '', transportistaId: '', estado: '', desde: '', hasta: '' };

const COLORES = {
  [ESTADOS.INGRESADO]: 'text-blue-500',
  [ESTADOS.EN_CAMINO]: 'text-yellow-600',
  [ESTADOS.ENTREGADO]: 'text-green-500',
  [ESTADOS.REPROGRAMADO]: 'text-orange-500',
  [ESTADOS.CANCELADO]: 'text-gray-500',
};

const COLUMNAS_ESTADO = COLUMNAS.map((col) => ({ ...col, color: COLORES[col.estado] }));

const Estadisticas = () => {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const { paquetes, loading, error } = usePaquetes(filtros);
  const { sellers, transportistas } = useCatalogos();
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState('');

  const { filas, totales } = useMemo(() => agruparPorPartido(paquetes), [paquetes]);

  // El Excel lo arma el servidor con los mismos filtros que la tabla, así sale
  // exactamente lo que se está viendo (y una hoja con el detalle por paquete).
  const descargarExcel = async () => {
    setDescargando(true);
    setErrorDescarga('');
    try {
      const params = new URLSearchParams({ formato: 'xlsx' });
      for (const [clave, valor] of Object.entries(filtros)) if (valor) params.set(clave, valor);
      const rango = filtros.desde || filtros.hasta
        ? `-${filtros.desde || 'inicio'}_${filtros.hasta || 'hoy'}`
        : '';
      await apiDescargar(`/api/paquetes?${params}`, `estadisticas-por-partido${rango}.xlsx`);
    } catch (err) {
      setErrorDescarga(err.message);
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Estadísticas por partido</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-gray-500">
              {loading ? 'Cargando...' : `${totales.total} envíos`}
            </span>
            <button
              type="button"
              onClick={descargarExcel}
              disabled={loading || descargando || filas.length === 0}
              className="text-xs sm:text-sm px-3 py-1.5 bg-marca-oro text-marca-grafito rounded-lg hover:bg-marca-oro-oscuro disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors duration-150"
            >
              {descargando ? 'Descargando...' : 'Descargar Excel'}
            </button>
          </div>
        </div>

        <FiltrosPaquetes
          valores={filtros}
          onChange={setFiltros}
          sellers={sellers}
          transportistas={transportistas}
        />

        {errorDescarga && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {errorDescarga}
          </p>
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Mobile y tablet: una tarjeta por partido. Siete columnas no entran en
            pantalla y el scroll horizontal esconde justo los totales. */}
        <div className="lg:hidden">
          {loading && <p className="py-6 text-center text-gray-500">Cargando estadísticas...</p>}
          {!loading && filas.length === 0 && !error && (
            <p className="py-6 text-center text-gray-500">
              No hay paquetes para los filtros seleccionados.
            </p>
          )}

          <div className="space-y-3">
            {!loading &&
              filas.map((fila) => (
                <div key={fila.partido} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-gray-800">{fila.partido}</p>
                    <p className="text-lg font-bold text-gray-800">{fila.total}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {COLUMNAS_ESTADO.map((col) => (
                      <div key={col.estado} className="flex justify-between gap-2">
                        <span className="text-gray-500 truncate">{col.label}</span>
                        <span className={`font-medium ${col.color}`}>{fila[col.estado] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {!loading && filas.length > 0 && (
            <div className="mt-4 pt-3 border-t-2 border-gray-200 flex items-baseline justify-between">
              <span className="font-bold text-gray-800">Total</span>
              <span className="text-xl font-bold text-gray-800">{totales.total}</span>
            </div>
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">Partido</th>
                <th className="py-2 px-2">Total</th>
                {COLUMNAS_ESTADO.map((col) => (
                  <th key={col.estado} className="py-2 px-2 whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNAS_ESTADO.length + 2} className="py-6 px-2 text-center text-gray-500">
                    Cargando estadísticas...
                  </td>
                </tr>
              )}
              {!loading && filas.length === 0 && !error && (
                <tr>
                  <td colSpan={COLUMNAS_ESTADO.length + 2} className="py-6 px-2 text-center text-gray-500">
                    No hay paquetes para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {!loading &&
                filas.map((fila) => (
                  <tr key={fila.partido} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-800">{fila.partido}</td>
                    <td className="py-2 px-2 font-semibold text-gray-700">{fila.total}</td>
                    {COLUMNAS_ESTADO.map((col) => (
                      <td key={col.estado} className={`py-2 px-2 font-medium ${col.color}`}>
                        {fila[col.estado] ?? 0}
                      </td>
                    ))}
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
