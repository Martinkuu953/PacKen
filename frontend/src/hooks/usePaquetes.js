import { useCallback, useEffect, useState } from 'react';
import { getPaquetes } from '../services/paquetes';

export function usePaquetes() {
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    getPaquetes()
      .then((data) => {
        setPaquetes(data.paquetes ?? []);
        setAviso(data.aviso ?? null);
        setError(null);
      })
      .catch((err) => {
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
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { paquetes, loading, error, aviso, recargar: cargar };
}
