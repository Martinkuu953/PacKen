import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartBar,
  FaUserTie,
  FaMotorcycle,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaClipboardList,
} from 'react-icons/fa';
import { usePaquetes } from '../hooks/usePaquetes';
import { colorEstado, normalizarEstado, prioridadEstado } from '../utils/estados';

function calcularResumen(paquetes) {
  const contar = (predicado) => paquetes.filter((p) => predicado(normalizarEstado(p.estado))).length;

  return {
    total: paquetes.length,
    entregados: contar((e) => e.includes('entregad')),
    demorados: contar((e) => e.includes('atrasad') || e.includes('demorad')),
    enCamino: contar((e) => e.includes('camino')),
    ingresados: contar((e) => e.includes('ingresad')),
    reprogramados: contar((e) => e.includes('reprogram')),
    cancelados: contar((e) => e.includes('cancel')),
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { paquetes, loading, error, aviso } = usePaquetes();

  const resumen = useMemo(() => calcularResumen(paquetes), [paquetes]);

  // En la tabla del dashboard mostramos los paquetes ordenados por importancia.
  const paquetesOrdenados = useMemo(
    () => [...paquetes].sort((a, b) => prioridadEstado(a.estado) - prioridadEstado(b.estado)),
    [paquetes],
  );

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="max-w-6xl mx-auto">

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">La Veloz</h2>

        {aviso && !error && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            {aviso}
          </p>
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex flex-col justify-between w-full lg:w-1/3 space-y-4">
            <div className="mb-2">
              <p className="text-2xl font-bold text-gray-800 mb-4">Paquetes Actuales</p>
              <p className="text-black-500 font-semibold text-sm uppercase">Entregados</p>
              <p className="text-4xl font-bold text-green-500">
                {loading ? '…' : `${resumen.entregados}/${resumen.total}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Demorados</p>
              <p className="text-xl font-bold text-red-500">
                {loading ? '…' : `${resumen.demorados}/${resumen.total}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">En camino</p>
              <p className="text-xl font-bold text-yellow-600">
                {loading ? '…' : `${resumen.enCamino}/${resumen.total}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Ingresados</p>
              <p className="text-xl font-bold text-blue-500">
                {loading ? '…' : `${resumen.ingresados}/${resumen.total}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Reprogramados</p>
              <p className="text-xl font-bold text-orange-500">
                {loading ? '…' : `${resumen.reprogramados}/${resumen.total}`}
              </p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Cancelados</p>
              <p className="text-xl font-bold text-red-500">
                {loading ? '…' : `${resumen.cancelados}/${resumen.total}`}
              </p>
            </div>
          </div>

          <div className="w-full lg:w-2/3 bg-gray-50 rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-2 px-2">ID Envío ML</th>
                  <th className="py-2 px-2">Comprador</th>
                  <th className="py-2 px-2">Dirección</th>
                  <th className="py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="py-6 px-2 text-center text-gray-500">
                      Cargando paquetes…
                    </td>
                  </tr>
                )}
                {!loading && paquetes.length === 0 && !error && (
                  <tr>
                    <td colSpan={4} className="py-6 px-2 text-center text-gray-500">
                      No hay paquetes registrados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  paquetesOrdenados.map((paquete, index) => (
                    <tr key={paquete.id ?? `${paquete.idenvioml}-${index}`} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 px-2 font-mono text-xs">{paquete.idenvioml}</td>
                      <td className="py-2 px-2 font-medium">{paquete.comprador}</td>
                      <td className="py-2 px-2 text-gray-600">{paquete.direccion}</td>
                      <td className={`py-2 px-2 font-bold ${colorEstado(paquete.estado)}`}>
                        {paquete.estado}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        <button
          onClick={() => handleNavigation('/estadisticas')}
          className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
        >
          <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
            <FaChartBar size={40} />
          </div>
          <span className="font-semibold text-gray-800">Estadísticas</span>
        </button>

        <button
          onClick={() => handleNavigation('/sellers')}
          className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
        >
          <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
            <FaUserTie size={40} />
          </div>
          <span className="font-semibold text-gray-800">Sellers</span>
        </button>

        <button
          onClick={() => handleNavigation('/transportistas')}
          className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
        >
          <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
            <FaMotorcycle size={40} />
          </div>
          <span className="font-semibold text-gray-800">Transportistas</span>
        </button>

        <button
          onClick={() => handleNavigation('/facturas')}
          className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
        >
          <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
            <FaFileInvoiceDollar size={40} />
          </div>
          <span className="font-semibold text-gray-800">Facturas</span>
        </button>

        <button
          onClick={() => handleNavigation('/liquidaciones')}
          className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
        >
          <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
            <FaMobileAlt size={40} />
          </div>
          <span className="font-semibold text-gray-800">Liquidaciones</span>
        </button>

        <button
          onClick={() => handleNavigation('/listas-precios')}
          className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
        >
          <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
            <FaClipboardList size={40} />
          </div>
          <span className="font-semibold text-gray-800">Lista de Precios</span>
        </button>
      </div>

    </div>
  );
};

export default Dashboard;
