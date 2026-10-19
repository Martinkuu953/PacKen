-- Liquidaciones: lo que la empresa le paga a cada transportista por los
-- paquetes que entregó en un período.
--
-- Modelo:
--   liquidacion          : la cabecera (transportista + rango de fechas + total)
--   liquidacion_detalle  : una fila por paquete entregado, con el importe que
--                          salió de la lista de costos del transportista.
--
-- El detalle guarda una COPIA de dirección, seller, zona e importe en vez de
-- resolverlos por JOIN al descargar: las tarifas, las zonas y hasta el nombre
-- del seller cambian con el tiempo, y una liquidación vieja tiene que poder
-- reimprimirse igual que el día que se emitió. Por eso idpaquete es solo una
-- referencia (ON DELETE SET NULL) y no la fuente de los datos.
--
-- Requiere migration-listas-flex.sql (lista / lista_zona_tarifa / idlista_costo)
-- y migration-public-id.sql. Ejecutar en Supabase -> SQL Editor.

BEGIN;

-- La base traía del modelo original una tabla `liquidacion` con otras columnas.
-- Con CREATE TABLE IF NOT EXISTS quedaba la vieja y el índice sobre public_id
-- fallaba ("column public_id does not exist"), así que se reemplaza.
--
-- Dos resguardos, porque esto borra tablas:
--   - Si alguna tiene filas, aborta en vez de borrar datos de alguien.
--   - El DROP va SIN CASCADE a propósito: si otro objeto depende de la tabla,
--     preferimos que Postgres corte con un error a que se lo lleve puesto.
-- Los IF van anidados y no con un AND: plpgsql prepara cada sentencia recién
-- cuando la ejecuta, así que la referencia a la tabla tiene que quedar adentro
-- del IF que comprueba que existe. Con un AND se parsea igual y falla en una
-- base donde la tabla no esté.
DO $$
BEGIN
  IF to_regclass('public.liquidacion') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM liquidacion) THEN
      RAISE EXCEPTION 'liquidacion ya tiene datos: revisala a mano antes de reemplazarla';
    END IF;
  END IF;

  IF to_regclass('public.liquidacion_detalle') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM liquidacion_detalle) THEN
      RAISE EXCEPTION 'liquidacion_detalle ya tiene datos: revisala a mano antes de reemplazarla';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS liquidacion_detalle;
DROP TABLE IF EXISTS liquidacion;

CREATE TABLE liquidacion (
  id              SERIAL PRIMARY KEY,
  public_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa       INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  -- SET NULL y no CASCADE: dar de baja a un transportista no puede borrar el
  -- registro de lo que se le pagó. Por eso el nombre va congelado en su propia
  -- columna, y el historial lo sigue mostrando aunque la cuenta ya no exista.
  idtransportista INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
  transportista   VARCHAR(150) NOT NULL,
  desde           DATE NOT NULL,
  hasta           DATE NOT NULL,
  cantidad        INTEGER NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_liquidacion_rango CHECK (desde <= hasta)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_liquidacion_public_id ON liquidacion(public_id);
-- El historial siempre pide "las últimas N de esta empresa".
CREATE INDEX IF NOT EXISTS idx_liquidacion_empresa_fecha ON liquidacion(idempresa, created_at DESC);

CREATE TABLE liquidacion_detalle (
  id            SERIAL PRIMARY KEY,
  idliquidacion INTEGER NOT NULL REFERENCES liquidacion(id) ON DELETE CASCADE,
  idpaquete     INTEGER REFERENCES paquete(id) ON DELETE SET NULL,
  idenvioml     VARCHAR(50),
  direccion     TEXT,
  fechaentrega  TIMESTAMPTZ,
  seller        VARCHAR(150),
  zona          VARCHAR(100),
  importe       NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_liquidacion_detalle_idliquidacion
  ON liquidacion_detalle(idliquidacion);

-- RLS: activo y sin policies (la API usa service role, que lo bypassea).
ALTER TABLE liquidacion         ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacion         FORCE  ROW LEVEL SECURITY;
ALTER TABLE liquidacion_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacion_detalle FORCE  ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT transportista, desde, hasta, cantidad, total FROM liquidacion ORDER BY created_at DESC;
