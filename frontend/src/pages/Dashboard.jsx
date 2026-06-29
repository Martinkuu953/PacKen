import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBoxOpen,
  FaChartBar,
  FaUserTie,
  FaMotorcycle,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaClipboardList,
} from 'react-icons/fa';
import { usePaquetes } from '../hooks/usePaquetes';
import { colorEstado, normalizarEstado, prioridadEstado } from '../utils/estados';
import { useAuth } from '../context/AuthContext';

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

const STATS = [
  { key: 'entregados', label: 'Entregados', color: 'text-green-500' },
  { key: 'demorados', label: 'Demorados', color: 'text-red-500' },
  { key: 'enCamino', label: 'En camino', color: 'text-yellow-600' },
  { key: 'ingresados', label: 'Ingresados', color: 'text-blue-500' },
  { key: 'reprogramados', label: 'Reprogramados', color: 'text-orange-500' },
  { key: 'cancelados', label: 'Cancelados', color: 'text-red-500' },
];

const ALL_SHORTCUTS = [
  { path: '/estadisticas', label: 'Estadísticas', Icon: FaChartBar, roles: ['empresa'] },
  { path: '/sellers', label: 'Sellers', Icon: FaUserTie, roles: ['empresa'] },
  { path: '/transportistas', label: 'Transportistas', Icon: FaMotorcycle, roles: ['empresa'] },
  { path: '/facturas', label: 'Facturas', Icon: FaFileInvoiceDollar, roles: ['empresa'] },
  { path: '/liquidaciones', label: 'Liquidaciones', Icon: FaMobileAlt, roles: ['empresa'] },
  { path: '/listas-precios', label: 'Lista de Precios', Icon: FaClipboardList, roles: ['empresa'] },
  { path: '/paquetes', label: 'Paquetes', Icon: FaBoxOpen, roles: ['transportista'] },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { paquetes, loading, error, aviso } = usePaquetes();
  const { usuario } = useAuth();

  const resumen = useMemo(() => calcularResumen(paquetes), [paquetes]);

  const paquetesOrdenados = useMemo(
    () => [...paquetes].sort((a, b) => prioridadEstado(a.estado) - prioridadEstado(b.estado)),
    [paquetes],
  );

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
          {usuario?.nombre || 'PacKen'}
        </h2>

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

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {STATS.map((stat) => (
            <div
              key={stat.key}
              className="bg-gray-50 rounded-xl px-2 py-2 sm:px-3 sm:py-3 text-center border border-gray-100"
            >
              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase truncate">
                {stat.label}
              </p>
              <p className={`text-sm sm:text-lg font-bold ${stat.color}`}>
                {loading ? '…' : `${resumen[stat.key]}/${resumen.total}`}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 sm:p-4 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">ID Envío ML</th>
                <th className="py-2 px-2 hidden lg:table-cell">Comprador</th>
                <th className="py-2 px-2">Dirección</th>
                <th className="py-2 px-2 hidden sm:table-cell">CP</th>
                <th className="py-2 px-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 px-2 text-center text-gray-500">
                    Cargando paquetes...
                  </td>
                </tr>
              )}
              {!loading && paquetes.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="py-6 px-2 text-center text-gray-500">
                    No hay paquetes registrados.
                  </td>
                </tr>
              )}
              {!loading &&
                paquetesOrdenados.map((paquete, index) => (
                  <tr key={paquete.id ?? `${paquete.idenvioml}-${index}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-2 font-mono text-xs">{paquete.idenvioml}</td>
                    <td className="py-2 px-2 font-medium hidden lg:table-cell">{paquete.comprador || '—'}</td>
                    <td className="py-2 px-2 text-gray-600">{paquete.direccion}</td>
                    <td className="py-2 px-2 text-gray-500 hidden sm:table-cell">{paquete.codigopostal || '—'}</td>
                    <td className={`py-2 px-2 font-bold ${colorEstado(paquete.estado)}`}>
                      {paquete.estado}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
        {ALL_SHORTCUTS.filter((s) => s.roles.includes(usuario?.rol)).map((shortcut) => (
          <button
            key={shortcut.path}
            onClick={() => handleNavigation(shortcut.path)}
            className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-4 sm:p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
          >
            <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-2 sm:mb-4">
              <shortcut.Icon size={28} className="sm:hidden" />
              <shortcut.Icon size={40} className="hidden sm:block" />
            </div>
            <span className="font-semibold text-gray-800 text-sm sm:text-base">{shortcut.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
