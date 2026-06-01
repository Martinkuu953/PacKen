import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartBar,
  FaUserTie,
  FaMotorcycle,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaClipboardList,
} from 'react-icons/fa';
import { getPaquetes } from '../services/paquetes';

function normalizarEstado(estado) {
  return String(estado ?? '').toLowerCase().trim();
}

function colorEstado(estado) {
  const e = normalizarEstado(estado);
  if (e.includes('atrasad') || e.includes('demorad')) return 'text-red-500';
  if (e.includes('entregad')) return 'text-green-500';
  if (e.includes('cancel')) return 'text-red-500';
  if (e.includes('reprogram')) return 'text-orange-500';
  return 'text-yellow-500';
}

function calcularResumen(paquetes) {
  const total = paquetes.length;
  const entregados = paquetes.filter((p) => normalizarEstado(p.estado).includes('entregad')).length;
  const demorados = paquetes.filter((p) => {
    const e = normalizarEstado(p.estado);
    return e.includes('atrasad') || e.includes('demorad');
  }).length;
  const reprogramados = paquetes.filter((p) => normalizarEstado(p.estado).includes('reprogram')).length;
  const cancelados = paquetes.filter((p) => normalizarEstado(p.estado).includes('cancel')).length;

  return { total, entregados, demorados, reprogramados, cancelados };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let activo = true;

    getPaquetes()
      .then((data) => {
        if (!activo) return;
        setPaquetes(data.paquetes ?? []);
        setAviso(data.aviso ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!activo) return;
        const msg = err.message ?? '';
        const backendApagado =
          msg.includes('fetch failed') ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError');
        setError(
          backendApagado
            ? 'No se pudo conectar con el backend. Ejecutá npm run dev desde la raíz del proyecto.'
            : msg,
        );
        setAviso(null);
        setPaquetes([]);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const resumen = useMemo(() => calcularResumen(paquetes), [paquetes]);

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
              <p className="text-xl font-bold text-yellow-500">
                {loading ? '…' : `${resumen.demorados}/${resumen.total}`}
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
                  <th className="py-2 px-2">Cliente Final</th>
                  <th className="py-2 px-2">Seller</th>
                  <th className="py-2 px-2">Transportista</th>
                  <th className="py-2 px-2">Ubicación</th>
                  <th className="py-2 px-2">Zona</th>
                  <th className="py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-6 px-2 text-center text-gray-500">
                      Cargando paquetes…
                    </td>
                  </tr>
                )}
                {!loading && paquetes.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="py-6 px-2 text-center text-gray-500">
                      No hay paquetes registrados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  paquetes.map((paquete, index) => (
                    <tr key={`${paquete.cliente}-${index}`} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 px-2 font-medium">{paquete.cliente}</td>
                      <td className="py-2 px-2">{paquete.seller}</td>
                      <td className="py-2 px-2">{paquete.transportista}</td>
                      <td className="py-2 px-2">{paquete.ubicacion}</td>
                      <td className="py-2 px-2">{paquete.zona}</td>
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
