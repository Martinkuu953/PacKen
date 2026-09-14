import { useState } from 'react';
import Sidebar from './Sidebar';
import Logo from './Logo';

const Layout = ({ children }) => {
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  return (
    <div className="flex bg-marca-crema min-h-screen">
      <Sidebar abierto={sidebarAbierto} onCerrar={() => setSidebarAbierto(false)} />

      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Header solo visible en mobile/tablet: botón a la izquierda, logo centrado.
            Va en el mismo amarillo que el sidebar: con el header blanco, la app
            se veía de un color en el celular y de otro en la compu.
            Las columnas de los costados son 1fr y la del medio auto, para que
            el logo ocupe su ancho natural en vez de que lo apriete un tercio
            fijo de pantalla y se achate. */}
        <header className="lg:hidden grid grid-cols-[1fr_auto_1fr] items-center bg-marca-amarillo border-b border-marca-oro/25 px-4 py-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarAbierto(true)}
            className="text-marca-grafito/70 hover:text-marca-grafito p-2 justify-self-start"
            aria-label="Abrir menú"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <span className="flex items-center justify-center justify-self-center">
            <Logo className="h-7" />
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