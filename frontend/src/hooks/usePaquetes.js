import { useEffect, useState } from 'react';
import { getPaquetes } from '../services/paquetes';

// Trae los paquetes del backend una sola vez y expone el estado de la carga.
// Lo usan tanto el Dashboard como la página de Paquetes para no repetir código.
export function usePaquetes() {
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let activo = true;

    getPaquetes()
      .then((data) => {
        if (!activo) return;
        setPaquetes(data.paquetes ?? []);
        setAviso(data.aviso ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!activo) return;
        const msg = err.message ?? '';
        const backendApagado =
          msg.includes('fetch failed') ||
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError');
        setError(
          backendApagado
            ? 'No se pudo conectar con el backend. Ejecutá npm run dev desde la raíz del proyecto.'
            : msg,
        );
        setAviso(null);
        setPaquetes([]);
      })
      .finally(() => {
        if (activo) setLoading(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  return { paquetes, loading, error, aviso };
}
