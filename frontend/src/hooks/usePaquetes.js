import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPaquetes } from '../services/paquetes';

export function usePaquetes(filtros = {}) {
  const [paquetes, setPaquetes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Los filtros llegan como objeto literal nuevo en cada render: sin esto el
  // efecto se dispararía en loop.
  const clave = JSON.stringify(filtros);
  const filtrosEstables = useMemo(() => JSON.parse(clave), [clave]);

  const cargar = useCallback(() => {
    setLoading(true);
    getPaquetes(filtrosEstables)
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
  }, [filtrosEstables]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { paquetes, loading, error, aviso, recargar: cargar };
}
