import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Pide `consultar(parametros)` al montar y cada vez que cambian los
// parámetros. Solo aplica la respuesta del último pedido: si el usuario cambia
// un filtro mientras otro pedido sigue en vuelo, el viejo no pisa al nuevo.
export function useConsulta(consultar, parametros = {}, { inicial = null } = {}) {
  const [datos, setDatos] = useState(inicial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const ultimoPedido = useRef(0);

  // Los parámetros llegan como objeto literal nuevo en cada render.
  const clave = JSON.stringify(parametros);
  const estables = useMemo(() => JSON.parse(clave), [clave]);

  const cargar = useCallback(() => {
    const pedido = ++ultimoPedido.current;
    setLoading(true);
    consultar(estables)
      .then((res) => {
        if (pedido !== ultimoPedido.current) return;
        setDatos(res);
        setError(null);
      })
      .catch((err) => {
        if (pedido !== ultimoPedido.current) return;
        setError(err.message ?? 'Error al cargar');
        setDatos(inicial);
      })
      .finally(() => {
        if (pedido === ultimoPedido.current) setLoading(false);
      });
    // `inicial` y `consultar` son fijos para cada pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estables]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { datos, loading, error, recargar: cargar };
}
