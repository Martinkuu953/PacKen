import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const allMenuItems = [
  { name: 'Inicio', path: '/', roles: ['empresa', 'transportista'] },
  { name: 'Sellers', path: '/sellers', roles: ['empresa'] },
  { name: 'Facturas', path: '/facturas', roles: ['empresa'] },
  { name: 'Transportistas', path: '/transportistas', roles: ['empresa'] },
  { name: 'Paquetes', path: '/paquetes', roles: ['empresa', 'transportista'] },
  { name: 'Estadísticas', path: '/estadisticas', roles: ['empresa'] },
  { name: 'Mi Perfil', path: '/perfil', roles: ['empresa', 'transportista'] },
  { name: 'Listas de precios', path: '/listas-precios', roles: ['empresa'] },
  { name: 'Liquidaciones', path: '/liquidaciones', roles: ['empresa'] },
];

const Sidebar = ({ abierto, onCerrar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, cerrarSesion } = useAuth();

  const menuItems = allMenuItems.filter((item) => item.roles.includes(usuario?.rol));

  const handleLogout = () => {
    cerrarSesion();
    navigate('/login');
  };

  return (
    <>
      {abierto && (
        <div
          onClick={onCerrar}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          bg-[#FDE047] h-screen fixed left-0 top-0 overflow-y-auto shadow-lg z-40
          w-64 transition-transform duration-200 flex flex-col
          ${abierto ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-6 flex-1">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              📦 PacKen
            </h1>
            <button
              onClick={onCerrar}
              className="text-gray-700 hover:text-gray-900 text-2xl font-bold lg:hidden"
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>
          <nav>
            <ul className="space-y-4 text-gray-800 font-medium">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    onClick={onCerrar}
                    className={`block px-4 py-2 rounded-md transition-colors ${
                      location.pathname === item.path
                        ? 'bg-white shadow-sm font-bold'
                        : 'hover:bg-yellow-300'
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="p-6 border-t border-yellow-400/50">
          {usuario && (
            <p className="text-xs text-gray-700 mb-3 truncate">
              <span className="font-semibold">{usuario.nombre}</span>
              <br />
              <span className="capitalize text-gray-600">{usuario.rol}</span>
            </p>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white/60 rounded-md hover:bg-white transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
