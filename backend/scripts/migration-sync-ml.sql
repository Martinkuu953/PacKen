-- Sincronización de estados contra la API de Mercado Libre.
--
-- Hasta ahora el estado de ML se traducía, se logueaba y se tiraba: la tabla
-- solo guardaba el estado interno. Sin el status crudo no había forma de
-- responder "¿por qué este paquete quedó en Reprogramado?" sin volver a
-- pegarle a ML, ni de saber cuándo fue la última vez que lo consultamos.
--
-- CORRER ESTO ANTES DE DESPLEGAR: el webhook y /api/paquetes/sincronizar
-- escriben estas tres columnas en cada actualización. Si el deploy sale
-- primero, todo update falla con "column paquete.estadoml does not exist".

BEGIN;

-- Status y substatus tal como los devuelve ML ("delivered", "not_delivered" +
-- "returning_to_sender", etc.). Texto libre a propósito: el catálogo de
-- substatus de ML es largo, cambia sin aviso y no lo controlamos nosotros.
ALTER TABLE paquete ADD COLUMN IF NOT EXISTS estadoml    text;
ALTER TABLE paquete ADD COLUMN IF NOT EXISTS subestadoml text;

-- Cuándo se consultó ML por última vez para este paquete. Es además el orden
-- de la cola del sync: los más viejos primero, NULL (nunca sincronizado)
-- antes que todos.
ALTER TABLE paquete ADD COLUMN IF NOT EXISTS ml_sincronizado_en timestamptz;

-- El webhook busca el paquete por el shipment id de ML en cada notificación.
-- Sin índice eso es un seq scan por cada aviso que manda Mercado Libre.
CREATE INDEX IF NOT EXISTS paquete_idenvioml_idx ON paquete (idenvioml);

-- Cola del sync. Parcial: los paquetes terminales no se consultan nunca más,
-- así que mantenerlos en el índice solo lo agranda.
CREATE INDEX IF NOT EXISTS paquete_cola_sync_ml_idx
  ON paquete (ml_sincronizado_en ASC NULLS FIRST)
  WHERE estado NOT IN ('Entregado', 'Cancelado');

COMMIT;
