import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const ENDPOINT = '/api/sellers';

const Sellers = () => {
  const [sellersData, setSellersData] = useState([]);
  const [montoTotal, setMontoTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const aplicar = useCallback((res) => {
    setSellersData(res.sellers ?? []);
    setMontoTotal(res.montoTotal ?? 0);
    setError('');
  }, []);

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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Sellers</h2>

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

        <div className="overflow-x-auto">
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

        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-gray-600">
              <span className="font-semibold">Total:</span> {totalPaquetes}
            </p>
            <p className="text-gray-600">
              <span className="font-semibold">En camino total:</span> {totalEnCamino}
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              ${(busqueda.trim() ? montoFiltrado : montoTotal).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sellers;
