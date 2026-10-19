BEGIN;

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS idempresa INTEGER REFERENCES usuario(id);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS estado_solicitud VARCHAR(20) DEFAULT 'pendiente'
  CHECK (estado_solicitud IN ('pendiente', 'aceptado', 'rechazado'));

COMMIT;
