import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPaquetes } from '../services/paquetes';

// habilitado = false no pide nada al servidor: lo usa Paquetes para no traer
// la tabla entera antes de que el administrador elija filtros.
export function usePaquetes(filtros = {}, { habilitado = true } = {}) {
  const [paquetes, setPaquetes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(habilitado);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  // Con búsqueda y paginación en el servidor se disparan pedidos seguidos: solo
  // se aplica la respuesta del último, para que una lenta no pise a una nueva.
  const ultimoPedido = useRef(0);

  // Los filtros llegan como objeto literal nuevo en cada render: sin esto el
  // efecto se dispararía en loop.
  const clave = JSON.stringify(filtros);
  const filtrosEstables = useMemo(() => JSON.parse(clave), [clave]);

  const cargar = useCallback(() => {
    const pedido = ++ultimoPedido.current;
    const vigente = () => pedido === ultimoPedido.current;
    if (!habilitado) {
      setPaquetes([]);
      setTotal(0);
      setAviso(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getPaquetes(filtrosEstables)
      .then((data) => {
        if (!vigente()) return;
        setPaquetes(data.paquetes ?? []);
        setTotal(data.total ?? (data.paquetes ?? []).length);
        setAviso(data.aviso ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!vigente()) return;
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
        setTotal(0);
      })
      .finally(() => {
        if (vigente()) setLoading(false);
      });
  }, [filtrosEstables, habilitado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { paquetes, total, loading, error, aviso, recargar: cargar };
}
