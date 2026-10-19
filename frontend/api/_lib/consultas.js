// Utilidades de consulta a Supabase pensadas para volumen.

// PostgREST corta toda respuesta en max_rows (1000 por defecto en Supabase).
// Truncar en silencio significa facturar de menos o contar mal, así que lo que
// necesita "todo" se pide página por página hasta que una venga incompleta.
// `construir` devuelve la query de nuevo en cada vuelta porque el builder de
// supabase-js se consume al ejecutarlo. Sirve también para .rpc().
//
// `maximo` corta antes (por ejemplo, el detalle de un Excel): devuelve
// { filas, truncado } en vez de solo las filas.
export const PAGINA = 1000;

export async function traerTodo(construir, { maximo = Infinity } = {}) {
  const filas = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const fin = Math.min(inicio + PAGINA, maximo) - 1;
    const { data, error } = await construir().range(inicio, fin);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    const pedidas = fin - inicio + 1;
    if ((data ?? []).length < pedidas) break;
    if (filas.length >= maximo) {
      return Number.isFinite(maximo) ? { filas, truncado: true } : filas;
    }
  }
  return Number.isFinite(maximo) ? { filas, truncado: false } : filas;
}

// Trae filas por id en tandas. Con un .in() de miles de ids la URL de
// PostgREST supera el límite y la consulta falla.
const TANDA_IDS = 200;

export async function buscarPorIds(supabase, tabla, campos, ids) {
  const unicos = [...new Set(ids.filter((id) => id != null))];
  const resultado = new Map();
  for (let i = 0; i < unicos.length; i += TANDA_IDS) {
    const tanda = unicos.slice(i, i + TANDA_IDS);
    const { data, error } = await supabase.from(tabla).select(campos).in('id', tanda);
    if (error) throw new Error(error.message);
    for (const fila of data ?? []) resultado.set(fila.id, fila);
  }
  return resultado;
}

// Resumen de paquetes de un seller/transportista (ver la función
// resumen_paquetes_por_entidad en migration-escala.sql).
export function resumenVacio() {
  return { totales: 0, enCamino: 0, entregados: 0, cancelados: 0, reprogramados: 0, monto: 0 };
}

// count/sum llegan como string desde PostgREST (bigint/numeric).
export function resumenDesdeFila(r) {
  return {
    totales: Number(r.totales ?? 0),
    enCamino: Number(r.en_camino ?? 0),
    entregados: Number(r.entregados ?? 0),
    cancelados: Number(r.cancelados ?? 0),
    reprogramados: Number(r.reprogramados ?? 0),
    monto: Math.round(Number(r.monto ?? 0) * 100) / 100,
  };
}

export async function resumenPorEntidad(supabase, idempresa, tipo) {
  const filas = await traerTodo(() =>
    supabase.rpc('resumen_paquetes_por_entidad', { p_idempresa: idempresa, p_tipo: tipo }),
  );
  return new Map(filas.map((r) => [Number(r.identidad), resumenDesdeFila(r)]));
}
