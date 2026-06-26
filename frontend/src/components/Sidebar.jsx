import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MENU_EMPRESA = [
  { name: 'Inicio', path: '/' },
  { name: 'Sellers', path: '/sellers' },
  { name: 'Facturas', path: '/facturas' },
  { name: 'Transportistas', path: '/transportistas' },
  { name: 'Paquetes', path: '/paquetes' },
  { name: 'Estadísticas', path: '/estadisticas' },
  { name: 'Mi Perfil', path: '/perfil' },
  { name: 'Listas de precios', path: '/listas-precios' },
  { name: 'Liquidaciones', path: '/liquidaciones' },
];

const MENU_TRANSPORTISTA = [
  { name: 'Inicio', path: '/' },
  { name: 'Paquetes', path: '/paquetes' },
  { name: 'Mi Perfil', path: '/perfil' },
];

const Sidebar = ({ abierto, onCerrar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { rol, perfil, logout } = useAuth();

  const menuItems = rol === 'transportista' ? MENU_TRANSPORTISTA : MENU_EMPRESA;

  const handleLogout = async () => {
    await logout();
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
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              PacKen
            </h1>
            <button
              onClick={onCerrar}
              className="text-gray-700 hover:text-gray-900 text-2xl font-bold lg:hidden"
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>

          {perfil && (
            <p className="text-sm text-gray-700 mb-6 truncate">
              {perfil.nombre}
            </p>
          )}

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

        <div className="p-6 pt-0">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-300 rounded-md transition-colors text-left"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
