import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  // Lista exacta del Figma
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
    // El amarillo característico de PacKen (tipo Mercado Libre)
    <aside className="w-64 bg-[#FDE047] h-screen fixed left-0 top-0 overflow-y-auto shadow-lg">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
          📦 PacKen
        </h1>
        <nav>
          <ul className="space-y-4 text-gray-800 font-medium">
            {menuItems.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.path}
                  className={`block px-4 py-2 rounded-md transition-colors ${
                    location.pathname === item.path
                      ? 'bg-white shadow-sm font-bold' // Estilo cuando está seleccionado
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
  );
};

export default Sidebar;