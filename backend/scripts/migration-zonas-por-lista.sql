-- Mapeo barrio→zona por lista de precios/costos.
--
-- Antes: `area_flex.idzona` era el único mapeo, uno por empresa. San Isidro era
-- Zona 1 para todos, y lo único que cambiaba por seller/transportista era
-- cuánto valía esa zona.
--
-- Ahora cada lista puede agrupar los barrios a su manera, porque una "zona"
-- solo significa algo dentro de un acuerdo tarifario: el mismo barrio puede ser
-- Zona 1 en la lista de un seller y Zona 2 en la de otro.
--
-- `area_flex.idzona` NO se borra: queda como el default de la empresa. Una lista
-- solo define los barrios que negoció distinto. Sin ese default, cada lista
-- nueva arrancaría sin ningún mapeo y todos sus paquetes liquidarían en $0
-- hasta completarla barrio por barrio.
--
-- El orden de resolución queda: override de la lista → default de la empresa →
-- la zona que quedó guardada en el paquete al escanearlo (paquetes viejos).
--
-- Requiere migration-listas-flex.sql. Ejecutar en Supabase → SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS lista_area_zona (
  id         SERIAL PRIMARY KEY,
  idlista    INTEGER NOT NULL REFERENCES lista(id)      ON DELETE CASCADE,
  idarea     INTEGER NOT NULL REFERENCES area_flex(id)  ON DELETE CASCADE,
  idzona     INTEGER NOT NULL REFERENCES zona(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un barrio cae en una sola zona dentro de una misma lista.
  CONSTRAINT uq_lista_area_zona UNIQUE (idlista, idarea)
);

CREATE INDEX IF NOT EXISTS idx_lista_area_zona_idlista ON lista_area_zona(idlista);

-- El barrio del paquete: hasta ahora se resolvía al escanear y solo quedaba el
-- idzona resultante. Con el mapeo por lista un paquete tiene DOS zonas a la vez
-- (la de la lista del seller y la de la del transportista), así que la zona no
-- se puede congelar: hay que guardar el barrio y resolverla al calcular.
--
-- Los paquetes viejos quedan en NULL y siguen usando su paquete.idzona; se les
-- puede completar con POST /api/paquetes/rezonificar, que le pregunta el barrio
-- a Mercado Libre.
ALTER TABLE paquete ADD COLUMN IF NOT EXISTS idarea INTEGER REFERENCES area_flex(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_paquete_idarea ON paquete(idarea);

ALTER TABLE lista_area_zona ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_area_zona FORCE  ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT COUNT(*) FROM paquete WHERE idarea IS NOT NULL;
--   SELECT l.nombre, a.nombre AS barrio, z.nombre AS zona
--     FROM lista_area_zona laz
--     JOIN lista l ON l.id = laz.idlista
--     JOIN area_flex a ON a.id = laz.idarea
--     JOIN zona z ON z.id = laz.idzona
--    ORDER BY l.nombre, a.nombre;
