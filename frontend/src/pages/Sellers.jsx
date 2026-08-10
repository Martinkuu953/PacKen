import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import FormNuevoSeller from '../components/FormNuevoSeller';
import { filtrarPorTexto } from '../utils/busqueda';

const ENDPOINT = '/api/sellers';

const ESTADOS_SELLER = [
  { campo: 'enCamino', label: 'En camino', color: 'text-yellow-600' },
  { campo: 'entregados', label: 'Entregados', color: 'text-green-500' },
  { campo: 'demorados', label: 'Demorados', color: 'text-red-500' },
  { campo: 'reprogramados', label: 'Reprogramados', color: 'text-orange-500' },
  { campo: 'cancelados', label: 'Cancelados', color: 'text-gray-500' },
];

const Sellers = () => {
  const [sellersData, setSellersData] = useState([]);
  const [montoTotal, setMontoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [conectando, setConectando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const aplicar = useCallback((res) => {
    setSellersData(res.sellers ?? []);
    setMontoTotal(res.montoTotal ?? 0);
    setError('');
  }, []);

  // Refresco silencioso (sin volver a mostrar "Cargando...") para después de
  // conectar un seller nuevo: la tabla ya tiene datos, solo hay que actualizarla.
  const recargar = useCallback(() => {
    return apiFetch(ENDPOINT).then(aplicar).catch((err) => setError(err.message));
  }, [aplicar]);

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

  // Al volver del login de Mercado Libre, /api/ml/callback nos manda acá con
  // ?ml=ok o ?ml=error. Guardamos el resultado una sola vez (al montar) para
  // que el cartel no desaparezca apenas limpiamos el query param de la URL.
  const [resultadoConexion] = useState(() => searchParams.get('ml'));
  useEffect(() => {
    if (!resultadoConexion) return;
    if (resultadoConexion === 'ok') recargar();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('ml');
        return next;
      },
      { replace: true },
    );
    // Solo al montar: resultadoConexion no cambia después de la inicialización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectarSeller = useCallback(() => {
    setConectando(true);
    setError('');
    apiFetch('/api/ml/conectar')
      .then((res) => {
        window.location.href = res.url;
      })
      .catch((err) => {
        setError(err.message);
        setConectando(false);
      });
  }, []);

  const sellersFiltrados = useMemo(
    () => filtrarPorTexto(sellersData, busqueda, ['nombre']),
    [sellersData, busqueda],
  );

  // Los totales se calculan sobre lo que se está viendo: si filtrás por un
  // seller, el resumen de abajo es el de ese seller.
  const totalPaquetes = sellersFiltrados.reduce((sum, seller) => sum + seller.totales, 0);
  const totalEnCamino = sellersFiltrados.reduce((sum, seller) => sum + seller.enCamino, 0);
  const montoFiltrado = sellersFiltrados.reduce((sum, seller) => sum + seller.monto, 0);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Sellers</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreando((prev) => !prev)}
              className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors duration-150 font-medium whitespace-nowrap"
            >
              Nuevo seller
            </button>
            <button
              type="button"
              onClick={conectarSeller}
              disabled={conectando}
              className="text-sm px-3 py-1.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors duration-150 font-medium whitespace-nowrap disabled:opacity-60"
            >
              {conectando ? 'Redirigiendo...' : 'Conectar con Mercado Libre'}
            </button>
          </div>
        </div>

        {creando && (
          <FormNuevoSeller
            onCreado={() => {
              setCreando(false);
              recargar();
            }}
            onCancelar={() => setCreando(false)}
          />
        )}

        {resultadoConexion === 'error' && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            No se pudo conectar el seller con Mercado Libre. Probá de nuevo.
          </p>
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {!loading && sellersData.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar seller por nombre..."
            resultados={sellersFiltrados.length}
            total={sellersData.length}
          />
        )}

        {/* Mobile y tablet: una tarjeta por seller. Las siete columnas de
            estados no entran en pantalla. */}
        <div className="lg:hidden">
          {loading && <p className="py-6 text-center text-gray-500">Cargando sellers...</p>}
          {!loading && sellersFiltrados.length === 0 && !error && (
            <p className="py-6 text-center text-gray-500">
              {busqueda.trim()
                ? `Ningún seller coincide con "${busqueda.trim()}".`
                : 'Todavía no tenés sellers cargados.'}
            </p>
          )}

          <div className="space-y-3">
            {!loading &&
              sellersFiltrados.map((seller) => (
                <div key={seller.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-gray-800">{seller.nombre}</p>
                    <p className="text-lg font-bold text-gray-800">{seller.totales}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {ESTADOS_SELLER.map((col) => (
                      <div key={col.campo} className="flex justify-between gap-2">
                        <span className="text-gray-500 truncate">{col.label}</span>
                        <span className={`font-medium ${col.color}`}>{seller[col.campo]}</span>
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
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Demorados</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Entregados</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Cancelados</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Reprogramados</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-gray-500">
                    Cargando sellers...
                  </td>
                </tr>
              )}
              {!loading && sellersFiltrados.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ningún seller coincide con "${busqueda.trim()}".`
                      : 'Todavía no tenés sellers cargados.'}
                  </td>
                </tr>
              )}
              {!loading &&
                sellersFiltrados.map((seller) => (
                  <tr key={seller.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-800">{seller.nombre}</td>
                    <td className="py-3 px-4 text-gray-600">{seller.totales}</td>
                    <td className="py-3 px-4 text-gray-600">{seller.enCamino}</td>
                    <td className="py-3 px-4 text-red-500 font-medium">{seller.demorados}</td>
                    <td className="py-3 px-4 text-green-500 font-medium">{seller.entregados}</td>
                    <td className="py-3 px-4 text-gray-500">{seller.cancelados}</td>
                    <td className="py-3 px-4 text-orange-500">{seller.reprogramados}</td>
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
    </div>
  );
};

export default Sellers;
