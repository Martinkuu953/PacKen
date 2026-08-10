-- Solo la tabla de lista_costos, sin tocar lista_precios.
--
-- OJO: si no corrés también el ALTER TABLE lista_precios DROP COLUMN costo
-- (ver migration-lista-precios-sin-costo.sql), la pantalla de Listas de
-- precios va a fallar al cargar tarifas nuevas: "costo" sigue siendo
-- NOT NULL sin default ahí y el código ya no lo manda. Si vas a correr
-- solo esto, ejecutá también la línea de abajo para no romper esa pantalla:
--
--   ALTER TABLE lista_precios ALTER COLUMN costo DROP NOT NULL;

BEGIN;

CREATE TABLE IF NOT EXISTS lista_costos (
  id              SERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa       INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  idtransportista INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  idzona          INTEGER NOT NULL REFERENCES zona(id)    ON DELETE CASCADE,
  costo           NUMERIC(12,2) NOT NULL CHECK (costo >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lista_costos_tarifa UNIQUE (idempresa, idtransportista, idzona)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_costos_public_id ON lista_costos(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_costos_idempresa ON lista_costos(idempresa);

ALTER TABLE lista_costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_costos FORCE  ROW LEVEL SECURITY;

COMMIT;
