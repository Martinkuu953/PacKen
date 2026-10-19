import { useCallback, useEffect, useMemo, useState } from 'react';

// Pide `consultar(parametros)` al montar y cada vez que cambian los
// parámetros. Solo se aplica la respuesta del último pedido: si el usuario
// cambia un filtro mientras otro pedido sigue en vuelo, el viejo no pisa al
// nuevo.
//
// "Cargando" no es un estado que se prende y se apaga: es que la última
// respuesta guardada no corresponde a los parámetros actuales. Así el efecto
// solo toca el estado cuando llega una respuesta.
export function useConsulta(consultar, parametros = {}, { inicial = null } = {}) {
  // Los parámetros llegan como objeto literal nuevo en cada render.
  const clave = JSON.stringify(parametros);
  const estables = useMemo(() => JSON.parse(clave), [clave]);
  const [version, setVersion] = useState(0);
  const pedido = `${clave}#${version}`;

  const [resultado, setResultado] = useState({ pedido: null, datos: inicial, error: null });

  useEffect(() => {
    let vigente = true;
    consultar(estables)
      .then((datos) => {
        if (vigente) setResultado({ pedido, datos, error: null });
      })
      .catch((err) => {
        if (vigente) setResultado({ pedido, datos: inicial, error: err.message ?? 'Error al cargar' });
      });
    return () => {
      vigente = false;
    };
  }, [consultar, estables, inicial, pedido]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const loading = resultado.pedido !== pedido;

  return { datos: resultado.datos, loading, error: loading ? null : resultado.error, recargar };
}
