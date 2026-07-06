-- Aislamiento multi-tenant de paquetes por empresa.
--
-- Antes, GET /api/paquetes devolvía TODOS los paquetes a cualquier empresa
-- (datos del comprador de otras empresas). Agregamos paquete.idempresa para
-- poder filtrar por la empresa dueña.
--
-- "Dueña" = la empresa (usuario rol='empresa') a la que pertenece el paquete:
--   - si lo escaneó un transportista  => la empresa de ese transportista
--   - si lo escaneó una empresa        => esa misma empresa
--
-- Ejecutar en Supabase → SQL Editor.

BEGIN;

ALTER TABLE paquete ADD COLUMN IF NOT EXISTS idempresa INTEGER REFERENCES usuario(id);
CREATE INDEX IF NOT EXISTS idx_paquete_idempresa ON paquete(idempresa);

-- Backfill de paquetes existentes que tienen transportista asignado.
UPDATE paquete p
SET idempresa = u.idempresa
FROM usuario u
WHERE p.idtransportista = u.id
  AND u.idempresa IS NOT NULL
  AND p.idempresa IS NULL;

COMMIT;

-- Nota: paquetes viejos sin idtransportista quedan con idempresa NULL y no
-- aparecerán para ninguna empresa (no hay forma de saber a quién pertenecían).
-- Los nuevos ya se crean con idempresa desde el endpoint de escaneo.
