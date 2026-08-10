-- Listas de precios: se deja de manejar "costo" en esta pantalla.
--
-- El costo pasa a vivir en la nueva tabla lista_costos (por transportista +
-- zona, ver migration-lista-costos.sql). Acá ya no tiene sentido: el margen
-- que se calculaba con costo/precio tampoco se usa más.
--
-- Ejecutar en Supabase → SQL Editor. Requiere migration-lista-precios.sql.

BEGIN;

ALTER TABLE lista_precios DROP COLUMN IF EXISTS costo;

COMMIT;
