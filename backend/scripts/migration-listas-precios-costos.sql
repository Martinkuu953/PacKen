-- Combinado para correr una sola vez en Supabase → SQL Editor:
--   1) Lista de costos por transportista + zona (tabla nueva lista_costos).
--   2) Lista de precios: se saca "costo" (y con eso el margen, que ya no se
--      guarda en ningún lado, solo se calculaba en la app).
--
-- Requiere migration-lista-precios.sql ya aplicada (usa las tablas zona y
-- lista_precios creadas ahí).

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1) Lista de costos (transportista + zona)
-- ──────────────────────────────────────────────────────────────────────────
-- Los transportistas no tienen tabla propia: son filas de "usuario" con
-- rol = 'transportista' (mismo criterio que /api/solicitudes).
CREATE TABLE IF NOT EXISTS lista_costos (
  id              SERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa       INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  idtransportista INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  idzona          INTEGER NOT NULL REFERENCES zona(id)    ON DELETE CASCADE,
  costo           NUMERIC(12,2) NOT NULL CHECK (costo >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una sola tarifa por combinación: el alta hace upsert sobre esta clave.
  CONSTRAINT uq_lista_costos_tarifa UNIQUE (idempresa, idtransportista, idzona)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_costos_public_id ON lista_costos(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_costos_idempresa ON lista_costos(idempresa);

-- Mismo criterio que el resto de las tablas: RLS activo y sin policies. La
-- API usa la service role key (que bypassea RLS); el anon key queda sin acceso.
ALTER TABLE lista_costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_costos FORCE  ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- 2) Lista de precios: se saca "costo"
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE lista_precios DROP COLUMN IF EXISTS costo;

COMMIT;
