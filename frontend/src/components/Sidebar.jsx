import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const allMenuItems = [
  { name: 'Inicio', path: '/', roles: ['empresa', 'transportista'] },
  { name: 'Sellers', path: '/sellers', roles: ['empresa'] },
  { name: 'Facturas', path: '/facturas', roles: ['empresa'] },
  { name: 'Transportistas', path: '/transportistas', roles: ['empresa'] },
  { name: 'Paquetes', path: '/paquetes', roles: ['empresa', 'transportista'] },
  { name: 'Estadísticas', path: '/estadisticas', roles: ['empresa'] },
  { name: 'Mi Perfil', path: '/perfil', roles: ['empresa', 'transportista'] },
  { name: 'Listas de precios/costos', path: '/listas', roles: ['empresa'] },
  { name: 'Establecer zonas', path: '/zonas', roles: ['empresa'] },
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
          bg-marca-amarillo h-screen fixed left-0 top-0 overflow-y-auto shadow-lg z-40
          w-64 transition-transform duration-200 flex flex-col
          ${abierto ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-6 flex-1">
          <div className="flex items-center justify-between mb-8">
            <h1 className="flex items-center">
              <Logo className="h-8" />
            </h1>
            <button
              onClick={onCerrar}
              className="text-marca-grafito/70 hover:text-marca-grafito text-2xl font-bold lg:hidden"
              aria-label="Cerrar menú"
            >
              ×
            </button>
          </div>
          <nav>
            <ul className="space-y-1.5 text-marca-grafito font-medium">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    onClick={onCerrar}
                    className={`block px-4 py-2 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-marca-crema shadow-sm font-bold'
                        : 'hover:bg-marca-amarillo-fuerte'
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="p-6 border-t border-marca-oro/25">
          {usuario && (
            <p className="text-xs text-marca-grafito/80 mb-3 truncate">
              <span className="font-semibold">{usuario.nombre}</span>
              <br />
              <span className="capitalize text-marca-grafito/60">{usuario.rol}</span>
            </p>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm font-medium text-marca-grafito bg-marca-crema/70 rounded-lg hover:bg-marca-crema transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
