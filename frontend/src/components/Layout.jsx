import { useState } from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen">
      <Sidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />

      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Header solo visible en mobile/tablet: botón a la izquierda, logo centrado */}
        <header className="lg:hidden grid grid-cols-3 items-center bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarAbierto(true)}
            className="text-gray-700 hover:text-gray-900 p-2 justify-self-start"
            aria-label="Abrir menú"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <span className="text-lg font-bold text-gray-800 flex items-center justify-center gap-2 justify-self-center">
            📦 PacKen
          </span>

          {/* Columna vacía para balancear el grid y mantener el logo realmente centrado */}
          <span />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;