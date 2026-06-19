import { Link, useLocation } from 'react-router-dom';

const Sidebar = ({ abierto, onCerrar }) => {
  const location = useLocation();

  const menuItems = [
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

  return (
    <>
      {/* Overlay oscuro detrás del drawer, solo visible en mobile/tablet cuando está abierto */}
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
          w-64 transition-transform duration-200
          ${abierto ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              📦 PacKen
            </h1>
            {/* Botón cerrar, solo visible en mobile/tablet */}
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
      </aside>
    </>
  );
};

export default Sidebar;