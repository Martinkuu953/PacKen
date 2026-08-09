-- Listas de precios y de costos, con nombre propio.
--
-- Reemplaza el modelo de "lista_precios" (una tarifa costo+precio por cada
-- combinación seller+zona) por listas con nombre que fijan un importe por
-- zona, y a las que se les asignan sellers (listas de precios) o
-- transportistas (listas de costos). Un seller/transportista pertenece a lo
-- sumo a una lista de su tipo a la vez.
--
-- "tipo" distingue ambos usos dentro de la misma tabla:
--   tipo = 'precio' → lo que la empresa le cobra al seller (se asigna en seller.idlistaprecio)
--   tipo = 'costo'  → lo que la empresa le paga al transportista (se asigna en usuario.idlistaprecio,
--                     sobre las filas con rol = 'transportista'; en esta app un transportista
--                     es una fila de "usuario", no la tabla "transportista" que no se usa)
--
-- IMPORTANTE: `listaprecio`, `listaprecio_detalle` y `seller.idlistaprecio`
-- ya existen en la base (creadas a mano, sin usar todavía desde el código),
-- pero en una forma más básica: sin idempresa/public_id/timestamps en
-- listaprecio, sin UNIQUE ni CHECK en listaprecio_detalle. Por eso este
-- script no asume tablas nuevas: usa ADD COLUMN IF NOT EXISTS y agrega los
-- constraints que faltan de forma idempotente (se puede correr de nuevo sin
-- romper nada).
--
-- La tabla/página vieja "lista_precios" / "/api/precios" queda intacta pero
-- sin uso: no se migran datos porque el costo pasa de estar atado al seller
-- a estar atado al transportista, y no hay forma de derivar uno del otro.
--
-- Ejecutar en Supabase → SQL Editor. Requiere migration-lista-precios.sql
-- (por la tabla zona) y migration-public-id.sql (por usuario.public_id).

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- listaprecio: agrega idempresa (aislamiento multi-tenant, igual que el
-- resto del schema), public_id (id opaco para la API) y timestamps.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE listaprecio ADD COLUMN IF NOT EXISTS idempresa  INTEGER REFERENCES usuario(id) ON DELETE CASCADE;
ALTER TABLE listaprecio ADD COLUMN IF NOT EXISTS public_id  UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE listaprecio ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE listaprecio ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Se asume la tabla vacía (todavía sin uso desde el código): si tuviera
-- filas sin idempresa esta línea falla y avisa, en vez de dejar filas
-- huérfanas sin empresa dueña.
ALTER TABLE listaprecio ALTER COLUMN idempresa SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listaprecio_tipo_check') THEN
    ALTER TABLE listaprecio ADD CONSTRAINT listaprecio_tipo_check CHECK (tipo IN ('precio', 'costo'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_listaprecio_public_id ON listaprecio(public_id);
CREATE INDEX IF NOT EXISTS idx_listaprecio_idempresa ON listaprecio(idempresa);

-- ──────────────────────────────────────────────────────────────────────────
-- listaprecio_detalle: un solo precio por (lista, zona) y no negativo.
-- ──────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_listaprecio_detalle') THEN
    ALTER TABLE listaprecio_detalle ADD CONSTRAINT uq_listaprecio_detalle UNIQUE (idlistaprecio, idzona);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'listaprecio_detalle_precio_check') THEN
    ALTER TABLE listaprecio_detalle ADD CONSTRAINT listaprecio_detalle_precio_check CHECK (precio >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listaprecio_detalle_lista ON listaprecio_detalle(idlistaprecio);

-- ──────────────────────────────────────────────────────────────────────────
-- Asignación de sellers a una lista de precios: seller.idlistaprecio ya
-- existe (con su FK a listaprecio); solo falta el índice.
-- ──────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seller_idlistaprecio ON seller(idlistaprecio);

-- ──────────────────────────────────────────────────────────────────────────
-- Asignación de transportistas (usuario.rol = 'transportista') a una lista
-- de costos: esta columna sí es nueva.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS idlistaprecio INTEGER REFERENCES listaprecio(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_usuario_idlistaprecio ON usuario(idlistaprecio);

-- Mismo criterio que las demás migraciones: RLS activo y sin policies, la
-- API usa la service role key.
ALTER TABLE listaprecio         ENABLE ROW LEVEL SECURITY;
ALTER TABLE listaprecio         FORCE  ROW LEVEL SECURITY;
ALTER TABLE listaprecio_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE listaprecio_detalle FORCE  ROW LEVEL SECURITY;

COMMIT;
