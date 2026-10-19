-- Lista de costos y precios por seller + zona.
--
-- Cada fila es la tarifa acordada para las entregas de UN seller en UNA zona:
--   costo  = lo que la empresa le paga al transportista por esa entrega
--   precio = lo que la empresa le cobra al seller
-- El margen es la diferencia y se calcula en la app, no se guarda (así no
-- puede quedar desincronizado con costo/precio).
--
-- La lista es por empresa: cada empresa ve y edita solo la suya, igual que
-- pasa con paquetes y solicitudes.
--
-- Ejecutar en Supabase → SQL Editor. Requiere migration-public-id.sql.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- Zonas
-- ──────────────────────────────────────────────────────────────────────────
-- La tabla ya existía (paquete.idzona la referencia) pero sin datos útiles:
-- el escaneo escribe idzona = 1 fijo. La completamos para poder tarifar.
CREATE TABLE IF NOT EXISTS zona (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(100)
);

ALTER TABLE zona ADD COLUMN IF NOT EXISTS nombre    VARCHAR(100);
ALTER TABLE zona ADD COLUMN IF NOT EXISTS cp_desde  INTEGER;
ALTER TABLE zona ADD COLUMN IF NOT EXISTS cp_hasta  INTEGER;
ALTER TABLE zona ADD COLUMN IF NOT EXISTS public_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_zona_public_id ON zona(public_id);

-- Zona por defecto: es la que usa hoy el escaneo (idzona = 1 hardcodeado).
INSERT INTO zona (id, nombre, cp_desde, cp_hasta)
VALUES (1, 'General', 1000, 9999)
ON CONFLICT (id) DO NOTHING;

-- Insertar un id explícito no mueve la secuencia; si no la reacomodamos, el
-- próximo INSERT sin id intentaría usar el 1 y chocaría.
SELECT setval(
  pg_get_serial_sequence('zona', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM zona), 1), 1)
);

-- ──────────────────────────────────────────────────────────────────────────
-- Sellers
-- ──────────────────────────────────────────────────────────────────────────
-- Mismo criterio que usuario: el cliente elige el seller por un UUID opaco,
-- el id interno no sale en ninguna respuesta.
ALTER TABLE seller ADD COLUMN IF NOT EXISTS public_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_public_id ON seller(public_id);

-- ──────────────────────────────────────────────────────────────────────────
-- Lista de precios
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lista_precios (
  id         SERIAL PRIMARY KEY,
  public_id  UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa  INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  idseller   INTEGER NOT NULL REFERENCES seller(id)  ON DELETE CASCADE,
  idzona     INTEGER NOT NULL REFERENCES zona(id)    ON DELETE CASCADE,
  costo      NUMERIC(12,2) NOT NULL CHECK (costo  >= 0),
  precio     NUMERIC(12,2) NOT NULL CHECK (precio >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una sola tarifa por combinación: el alta hace upsert sobre esta clave.
  CONSTRAINT uq_lista_precios_tarifa UNIQUE (idempresa, idseller, idzona)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_precios_public_id ON lista_precios(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_precios_idempresa ON lista_precios(idempresa);

-- Mismo criterio que migration-rls.sql: RLS activo y sin policies. La API usa
-- la service role key (que bypassea RLS); el anon key queda sin acceso.
ALTER TABLE zona          ENABLE ROW LEVEL SECURITY;
ALTER TABLE zona          FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_precios FORCE  ROW LEVEL SECURITY;

COMMIT;

-- Zonas de ejemplo para arrancar (opcional, ajustá los CP a tu operación):
--
-- INSERT INTO zona (nombre, cp_desde, cp_hasta) VALUES
--   ('CABA',      1000, 1499),
--   ('GBA Norte', 1600, 1669),
--   ('GBA Sur',   1800, 1899),
--   ('Interior',  2000, 9999);
