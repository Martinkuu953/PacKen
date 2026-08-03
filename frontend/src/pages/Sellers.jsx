import { useMemo, useState } from 'react';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const Sellers = () => {
  const [sellersData] = useState([
    { nombre: 'Baby Movil', totales: 100, enCamino: 40, demorados: 11, entregados: 32, cancelados: 5, reprogramados: 12 },
    { nombre: 'Baby Movil', totales: 100, enCamino: 40, demorados: 11, entregados: 32, cancelados: 5, reprogramados: 12 },
    { nombre: 'Baby Movil', totales: 100, enCamino: 40, demorados: 11, entregados: 31, cancelados: 5, reprogramados: 12 },
    { nombre: 'Baby Movil', totales: 100, enCamino: 40, demorados: 11, entregados: 32, cancelados: 5, reprogramados: 12 },
    { nombre: 'Baby Movil', totales: 100, enCamino: 40, demorados: 10, entregados: 32, cancelados: 5, reprogramados: 12 },
    { nombre: 'Baby Movil', totales: 100, enCamino: 39, demorados: 11, entregados: 32, cancelados: 5, reprogramados: 12 },
    { nombre: 'Baby Movil', totales: 100, enCamino: 40, demorados: 11, entregados: 32, cancelados: 5, reprogramados: 12 },
  ]);

  const [busqueda, setBusqueda] = useState('');

  const sellersFiltrados = useMemo(
    () => filtrarPorTexto(sellersData, busqueda, ['nombre']),
    [sellersData, busqueda],
  );

  // Los totales se calculan sobre lo que se está viendo: si filtrás por un
  // seller, el resumen de abajo es el de ese seller.
  const totalPaquetes = sellersFiltrados.reduce((sum, seller) => sum + seller.totales, 0);
  const totalEnCamino = sellersFiltrados.reduce((sum, seller) => sum + seller.enCamino, 0);
  const montoTotal = 300000;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Sellers</h2>

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar seller por nombre..."
          resultados={sellersFiltrados.length}
          total={sellersData.length}
        />

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
              {sellersFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 px-4 text-center text-gray-500">
                    Ningún seller coincide con &quot;{busqueda.trim()}&quot;.
                  </td>
                </tr>
              )}
              {sellersFiltrados.map((seller, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
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
              ${montoTotal.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sellers;
