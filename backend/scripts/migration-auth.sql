BEGIN;

CREATE TABLE IF NOT EXISTS usuario (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  dni         VARCHAR(20)  UNIQUE,
  password    VARCHAR(255) NOT NULL,
  rol         VARCHAR(20)  NOT NULL CHECK (rol IN ('transportista', 'empresa')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);
CREATE INDEX IF NOT EXISTS idx_usuario_dni ON usuario(dni) WHERE dni IS NOT NULL;

ALTER TABLE paquete ADD COLUMN IF NOT EXISTS idtransportista INTEGER REFERENCES usuario(id);
CREATE INDEX IF NOT EXISTS idx_paquete_idtransportista ON paquete(idtransportista);

COMMIT;
