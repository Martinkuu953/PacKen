import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

// Sellers y transportistas activos de la empresa, para poblar los filtros y el
// selector de reasignación. Ambos endpoints son de rol empresa.
export function useCatalogos() {
  const [sellers, setSellers] = useState([]);
  const [transportistas, setTransportistas] = useState([]);

  useEffect(() => {
    let cancelado = false;

    Promise.all([
      apiFetch('/api/sellers').catch(() => ({ sellers: [] })),
      apiFetch('/api/transportistas').catch(() => ({ transportistas: [] })),
    ]).then(([resSellers, resTransportistas]) => {
      if (cancelado) return;
      setSellers((resSellers.sellers ?? []).map((s) => ({ id: s.id, nombre: s.nombre })));
      setTransportistas(
        (resTransportistas.transportistas ?? []).map((t) => ({ id: t.id, nombre: t.nombre })),
      );
    });

    return () => {
      cancelado = true;
    };
  }, []);

  return { sellers, transportistas };
}
