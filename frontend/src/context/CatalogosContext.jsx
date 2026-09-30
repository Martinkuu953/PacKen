import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from './AuthContext';

const CatalogosContext = createContext(null);

// Sellers y transportistas de la empresa, para poblar los filtros y el selector
// de reasignación. Se piden una sola vez por sesión y se comparten entre todas
// las pantallas; las que los modifican (Sellers, Transportistas) llaman a
// recargarCatalogos para que el resto se entere sin volver a montar nada.
// Ambos endpoints son de rol empresa: para otros roles el catálogo queda vacío.
export function CatalogosProvider({ children }) {
  const { esEmpresa } = useAuth();
  const [sellers, setSellers] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [listos, setListos] = useState(false);

  const pedirCatalogos = useCallback(
    () =>
      Promise.all([
        apiFetch('/api/sellers').catch(() => ({ sellers: [] })),
        apiFetch('/api/transportistas').catch(() => ({ transportistas: [] })),
      ]).then(([resSellers, resTransportistas]) => ({
        sellers: (resSellers.sellers ?? []).map((s) => ({ id: s.id, nombre: s.nombre })),
        transportistas: (resTransportistas.transportistas ?? []).map((t) => ({
          id: t.id,
          nombre: t.nombre,
        })),
      })),
    [],
  );

  const aplicar = useCallback((catalogos) => {
    setSellers(catalogos.sellers);
    setTransportistas(catalogos.transportistas);
  }, []);

  const recargarCatalogos = useCallback(() => {
    if (!esEmpresa) return Promise.resolve();
    return pedirCatalogos().then(aplicar);
  }, [esEmpresa, pedirCatalogos, aplicar]);

  // Carga al iniciar sesión como empresa; al cerrar sesión (o si el usuario no
  // es empresa) se vacía, para que no quede el catálogo de otra cuenta.
  useEffect(() => {
    if (!esEmpresa) return undefined;

    let cancelado = false;
    pedirCatalogos()
      .then((catalogos) => {
        if (!cancelado) aplicar(catalogos);
      })
      .finally(() => {
        if (!cancelado) setListos(true);
      });

    return () => {
      cancelado = true;
      aplicar({ sellers: [], transportistas: [] });
      setListos(false);
    };
  }, [esEmpresa, pedirCatalogos, aplicar]);

  const cargandoCatalogos = esEmpresa && !listos;

  return (
    <CatalogosContext.Provider value={{
      sellers, transportistas, cargandoCatalogos, recargarCatalogos,
    }}>
      {children}
    </CatalogosContext.Provider>
  );
}

export function useCatalogos() {
  const ctx = useContext(CatalogosContext);
  if (!ctx) throw new Error('useCatalogos debe usarse dentro de CatalogosProvider');
  return ctx;
}
