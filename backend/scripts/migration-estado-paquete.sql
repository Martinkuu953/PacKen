-- Enumerado de paquete.estado a nivel base de datos.
--
-- Hasta ahora la columna era texto libre y la única validación estaba en el
-- código. Por eso convivían grafías distintas del mismo estado ("EN CAMINO",
-- "en_camino", "En Camino ") y los filtros por igualdad exacta dejaban
-- paquetes afuera del listado.
--
-- Se usa CHECK y no CREATE TYPE ... AS ENUM a propósito: agregar un estado
-- nuevo a un enum de Postgres obliga a un ALTER TYPE que no se puede revertir
-- en una transacción, mientras que el CHECK se reemplaza sin drama. Además es
-- el mismo patrón que ya usa usuario.estado_solicitud.

BEGIN;

-- 1) Normalizar lo que ya está cargado. El orden replica el de canonizarEstado
--    en frontend/shared/estados.js: atrasado/demorado primero, ingresado al
--    final, porque 'pendiente' es el caso más ambiguo.
UPDATE paquete SET estado = 'Atrasado'     WHERE lower(estado) LIKE '%atrasad%';
UPDATE paquete SET estado = 'Demorado'     WHERE lower(estado) LIKE '%demorad%';
UPDATE paquete SET estado = 'Cancelado'    WHERE lower(estado) LIKE '%cancel%';
UPDATE paquete SET estado = 'Entregado'    WHERE lower(estado) LIKE '%entregad%';
UPDATE paquete SET estado = 'Reprogramado' WHERE lower(estado) LIKE '%reprogram%';
UPDATE paquete SET estado = 'En camino'
  WHERE lower(estado) LIKE '%camino%'
     OR lower(estado) LIKE '%transito%'
     OR lower(estado) LIKE '%reparto%';
UPDATE paquete SET estado = 'Ingresado'
  WHERE lower(estado) LIKE '%ingresad%'
     OR lower(estado) LIKE '%colecta%'
     OR lower(estado) LIKE '%pendiente%';

-- 2) Un paquete sin estado es un paquete recién ingresado.
UPDATE paquete SET estado = 'Ingresado' WHERE estado IS NULL OR btrim(estado) = '';

-- 3) Antes de aplicar el constraint, revisar si quedó algo sin reconocer.
--    Si esta consulta devuelve filas, el ALTER TABLE de abajo va a fallar:
--    mirá esos valores y decidí a qué estado corresponden.
--
--    SELECT DISTINCT estado FROM paquete
--    WHERE estado NOT IN ('Ingresado','En camino','Entregado','Cancelado',
--                         'Reprogramado','Atrasado','Demorado');

ALTER TABLE paquete DROP CONSTRAINT IF EXISTS paquete_estado_check;

ALTER TABLE paquete
  ADD CONSTRAINT paquete_estado_check
  CHECK (estado IN (
    'Ingresado',
    'En camino',
    'Entregado',
    'Cancelado',
    'Reprogramado',
    'Atrasado',
    'Demorado'
  ));

ALTER TABLE paquete ALTER COLUMN estado SET NOT NULL;
ALTER TABLE paquete ALTER COLUMN estado SET DEFAULT 'Ingresado';

COMMIT;
