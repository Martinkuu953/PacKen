-- Lista de costos por transportista + zona.
--
-- Igual que lista_precios (ver migration-lista-precios.sql) pero tarifando
-- transportistas en vez de sellers:
--   costo = lo que la empresa le paga al transportista por esa entrega
--
-- Los transportistas no tienen tabla propia: son filas de "usuario" con
-- rol = 'transportista' (mismo criterio que /api/solicitudes).
--
-- La lista es por empresa: cada empresa ve y edita solo la suya.
--
-- Ejecutar en Supabase → SQL Editor. Requiere migration-lista-precios.sql
-- (usa la tabla zona ya creada ahí).

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
  -- Una sola tarifa por combinación: el alta hace upsert sobre esta clave.
  CONSTRAINT uq_lista_costos_tarifa UNIQUE (idempresa, idtransportista, idzona)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_costos_public_id ON lista_costos(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_costos_idempresa ON lista_costos(idempresa);

-- Mismo criterio que migration-rls.sql: RLS activo y sin policies. La API usa
-- la service role key (que bypassea RLS); el anon key queda sin acceso.
ALTER TABLE lista_costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_costos FORCE  ROW LEVEL SECURITY;

COMMIT;
