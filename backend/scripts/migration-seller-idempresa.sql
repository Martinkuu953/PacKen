-- Corrige seller.idempresa: quedó como UUID desde antes de que se
-- estandarizara "idempresa" como INTEGER REFERENCES usuario(id) en el resto
-- del esquema (paquete, lista_precios, usuario.idempresa). Nunca se llegó a
-- popular (ambos sellers existentes tienen idempresa NULL), así que
-- cualquier filtro por empresa sobre "seller" rompía con
-- "invalid input syntax for type uuid".
--
-- Ejecutar en Supabase → SQL Editor.

BEGIN;

ALTER TABLE seller DROP COLUMN IF EXISTS idempresa;
ALTER TABLE seller ADD COLUMN idempresa INTEGER REFERENCES usuario(id);

-- Backfill: hoy hay una sola empresa en el sistema (id=1, misma que usa
-- registrar-seller.mjs como "empresa por defecto").
UPDATE seller SET idempresa = 1 WHERE idempresa IS NULL;

ALTER TABLE seller ALTER COLUMN idempresa SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seller_idempresa ON seller(idempresa);

COMMIT;

-- Verificación: SELECT id, idempresa, nombre FROM seller;
