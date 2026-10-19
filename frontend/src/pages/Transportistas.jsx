import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { useCatalogos } from '../context/CatalogosContext';
import Buscador from '../components/Buscador';
import FormNuevoTransportista from '../components/FormNuevoTransportista';
import DetalleTransportista from '../components/DetalleTransportista';
import { filtrarPorTexto } from '../utils/busqueda';

const ENDPOINT = '/api/transportistas';

const CAMPOS_BUSQUEDA = ['nombre', 'dni'];

const ESTADOS_TRANSPORTISTA = [
  { campo: 'enCamino', label: 'En camino', color: 'text-yellow-600' },
  { campo: 'entregados', label: 'Entregados', color: 'text-green-500' },
  { campo: 'reprogramados', label: 'Reprogramados', color: 'text-orange-500' },
  { campo: 'cancelados', label: 'Cancelados', color: 'text-gray-500' },
];

const Transportistas = () => {
  const [transportistasData, setTransportistasData] = useState([]);
  const [montoTotal, setMontoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [transportistaSeleccionado, setTransportistaSeleccionado] = useState(null);
  const { recargarCatalogos } = useCatalogos();

  const aplicar = useCallback((res) => {
    setTransportistasData(res.transportistas ?? []);
    setMontoTotal(res.montoTotal ?? 0);
    setError('');
  }, []);

  // Refresco silencioso (sin volver a mostrar "Cargando...") para después de
  // crear un transportista. También refresca el catálogo global (filtros y
  // reasignación de Paquetes).
  const recargar = useCallback(() => {
    recargarCatalogos();
    return apiFetch(ENDPOINT).then(aplicar).catch((err) => setError(err.message));
  }, [aplicar, recargarCatalogos]);

  useEffect(() => {
    let cancelado = false;
    apiFetch(ENDPOINT)
      .then((res) => {
        if (!cancelado) aplicar(res);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aplicar]);

  const transportistaEliminado = useCallback((transportistaId) => {
    setTransportistasData((prev) => prev.filter((t) => t.id !== transportistaId));
    setTransportistaSeleccionado(null);
    recargarCatalogos();
  }, [recargarCatalogos]);

  const transportistasFiltrados = useMemo(
    () => filtrarPorTexto(transportistasData, busqueda, CAMPOS_BUSQUEDA),
    [transportistasData, busqueda],
  );

  // Los totales se calculan sobre lo que se está viendo: si filtrás por un
  // transportista, el resumen de abajo es el de ese transportista.
  const totalPaquetes = transportistasFiltrados.reduce((sum, t) => sum + t.totales, 0);
  const totalEnCamino = transportistasFiltrados.reduce((sum, t) => sum + t.enCamino, 0);
  const montoFiltrado = transportistasFiltrados.reduce((sum, t) => sum + t.monto, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Transportistas</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreando((prev) => !prev)}
              className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors duration-150 font-medium whitespace-nowrap"
            >
              Nuevo transportista
            </button>
          </div>
        </div>

        {creando && (
          <FormNuevoTransportista
            onCreado={() => {
              setCreando(false);
              recargar();
            }}
            onCancelar={() => setCreando(false)}
          />
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {!loading && transportistasData.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar transportista por nombre o DNI..."
            resultados={transportistasFiltrados.length}
            total={transportistasData.length}
          />
        )}

        {/* Mobile y tablet: una tarjeta por transportista. Las columnas de
            estados no entran en pantalla. */}
        <div className="lg:hidden">
          {loading && <p className="py-6 text-center text-gray-500">Cargando transportistas...</p>}
          {!loading && transportistasFiltrados.length === 0 && !error && (
            <p className="py-6 text-center text-gray-500">
              {busqueda.trim()
                ? `Ningún transportista coincide con "${busqueda.trim()}".`
                : 'Todavía no creaste ningún transportista.'}
            </p>
          )}

          <div className="space-y-3">
            {!loading &&
              transportistasFiltrados.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTransportistaSeleccionado(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setTransportistaSeleccionado(t)}
                  className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-yellow-400 active:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-gray-800">{t.nombre}</p>
                    <p className="text-lg font-bold text-gray-800">{t.totales}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {ESTADOS_TRANSPORTISTA.map((col) => (
                      <div key={col.campo} className="flex justify-between gap-2">
                        <span className="text-gray-500 truncate">{col.label}</span>
                        <span className={`font-medium ${col.color}`}>{t[col.campo]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Nombre</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Totales</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">En camino</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Entregados</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Cancelados</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Reprogramados</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-gray-500">
                    Cargando transportistas...
                  </td>
                </tr>
              )}
              {!loading && transportistasFiltrados.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ningún transportista coincide con "${busqueda.trim()}".`
                      : 'Todavía no creaste ningún transportista.'}
                  </td>
                </tr>
              )}
              {!loading &&
                transportistasFiltrados.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setTransportistaSeleccionado(t)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-gray-800">{t.nombre}</td>
                    <td className="py-3 px-4 text-gray-600">{t.totales}</td>
                    <td className="py-3 px-4 text-gray-600">{t.enCamino}</td>
                    <td className="py-3 px-4 text-green-500 font-medium">{t.entregados}</td>
                    <td className="py-3 px-4 text-gray-500">{t.cancelados}</td>
                    <td className="py-3 px-4 text-orange-500">{t.reprogramados}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap justify-between items-center gap-3">
          <div className="space-y-1">
            <p className="text-sm sm:text-base text-gray-600">
              <span className="font-semibold">Total:</span> {totalPaquetes}
            </p>
            <p className="text-sm sm:text-base text-gray-600">
              <span className="font-semibold">En camino total:</span> {totalEnCamino}
            </p>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            ${(busqueda.trim() ? montoFiltrado : montoTotal).toLocaleString()}
          </p>
        </div>
      </div>

      {transportistaSeleccionado && (
        <DetalleTransportista
          transportista={transportistaSeleccionado}
          onCerrar={() => setTransportistaSeleccionado(null)}
          onEliminado={transportistaEliminado}
        />
      )}
    </div>
  );
};

export default Transportistas;
