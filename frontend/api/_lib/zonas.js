// Resolución de la zona de un paquete DENTRO de una lista de precios/costos.
//
// Un paquete no tiene una zona sola: tiene la que le corresponde en la lista
// del seller (para cobrarle) y la que le corresponde en la del transportista
// (para pagarle), y pueden ser distintas. Por eso la zona no se guarda en el
// paquete: se guarda el barrio (`paquete.idarea`) y la zona se resuelve acá,
// al momento de calcular.
//
// Orden de resolución, de más específico a más general:
//   1. `lista_area_zona` — lo que esa lista definió para ese barrio.
//   2. `area_flex.idzona` — el default de la empresa ("Establecer zonas").
//   3. `paquete.idzona` — la zona que quedó congelada al escanear. Es la red
//      para los paquetes viejos, de antes de que existiera `idarea`.
//
// Sin el paso 2 cada lista nueva arrancaría sin mapeo y sus paquetes liquidarían
// en $0; sin el paso 3 los paquetes viejos se quedarían sin zona.

/**
 * Precarga el mapeo y devuelve una función de resolución sincrónica.
 *
 * Se cargan los dos mapeos completos de una (son chicos: barrios de una empresa
 * y overrides de unas pocas listas) en vez de consultar por paquete, que serían
 * cientos de consultas en una liquidación.
 */
export async function cargarResolutorZonas(supabase, idempresa, idsListas = []) {
  const { data: areas, error } = await supabase
    .from('area_flex')
    .select('id, idzona')
    .eq('idempresa', idempresa);
  if (error) throw new Error(error.message);

  const porDefecto = new Map((areas ?? []).map((a) => [a.id, a.idzona]));

  const listas = [...new Set(idsListas.filter((id) => id != null))];
  let overrides = new Map();
  if (listas.length) {
    const { data, error: errOv } = await supabase
      .from('lista_area_zona')
      .select('idlista, idarea, idzona')
      .in('idlista', listas);
    if (errOv) throw new Error(errOv.message);
    overrides = new Map((data ?? []).map((o) => [`${o.idlista}:${o.idarea}`, o.idzona]));
  }

  return function zonaDe(idlista, idarea, idzonaGuardada = null) {
    if (idarea != null) {
      const propia = overrides.get(`${idlista}:${idarea}`);
      if (propia != null) return propia;

      const defecto = porDefecto.get(idarea);
      if (defecto != null) return defecto;
    }
    return idzonaGuardada;
  };
}
