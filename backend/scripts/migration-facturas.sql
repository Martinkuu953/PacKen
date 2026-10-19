-- Facturas: lo que la empresa le cobra a cada seller por los paquetes que se
-- le entregaron en un período.
--
-- Es el espejo de `liquidacion` (migration-liquidaciones.sql): misma forma,
-- misma lógica, pero del otro lado del mostrador. La liquidación le paga al
-- transportista con su lista de COSTOS (usuario.idlista_costo); la factura le
-- cobra al seller con su lista de PRECIOS (seller.idlista). Un mismo paquete
-- entregado aparece en las dos, con importes distintos: la diferencia es lo
-- que gana la empresa.
--
-- Modelo:
--   factura          : la cabecera (seller + rango de fechas + total)
--   factura_detalle  : una fila por paquete entregado, con el importe que salió
--                      de la lista de precios del seller.
--
-- El detalle guarda una COPIA de dirección, transportista, zona e importe en
-- vez de resolverlos por JOIN al descargar: las tarifas y las zonas cambian con
-- el tiempo, y una factura vieja tiene que poder reimprimirse igual que el día
-- que se emitió. Por eso idpaquete es solo una referencia (ON DELETE SET NULL)
-- y no la fuente de los datos.
--
-- Requiere migration-listas-flex.sql (lista / lista_zona_tarifa / seller.idlista)
-- y migration-public-id.sql. Ejecutar en Supabase -> SQL Editor.

BEGIN;

-- Mismo resguardo que en liquidaciones: la base traía del modelo original
-- tablas con estos nombres y otras columnas, y un CREATE TABLE IF NOT EXISTS
-- dejaba la vieja, con lo cual el índice sobre public_id fallaba.
--
-- Acá no es hipotético: la `factura` del modelo original existe y es
-- (idseller, fechadesde, fechahasta, montototal, rutaarchivopdf, fechaemision),
-- sin detalle, sin public_id y sin idempresa. Si tiene filas que valga la pena
-- conservar, guardala al costado ANTES de correr esto:
--
--   ALTER TABLE factura RENAME TO factura_legacy;
--
-- Dos resguardos, porque esto borra tablas:
--   - Si alguna tiene filas, aborta en vez de borrar datos de alguien.
--   - El DROP va SIN CASCADE a propósito: si otro objeto depende de la tabla,
--     preferimos que Postgres corte con un error a que se lo lleve puesto.
-- Los IF van anidados y no con un AND: plpgsql prepara cada sentencia recién
-- cuando la ejecuta, así que la referencia a la tabla tiene que quedar adentro
-- del IF que comprueba que existe.
DO $$
BEGIN
  IF to_regclass('public.factura') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM factura) THEN
      RAISE EXCEPTION 'factura ya tiene datos: revisala a mano antes de reemplazarla';
    END IF;
  END IF;

  IF to_regclass('public.factura_detalle') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM factura_detalle) THEN
      RAISE EXCEPTION 'factura_detalle ya tiene datos: revisala a mano antes de reemplazarla';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS factura_detalle;
DROP TABLE IF EXISTS factura;

CREATE TABLE factura (
  id         SERIAL PRIMARY KEY,
  public_id  UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa  INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  -- SET NULL y no CASCADE: dar de baja a un seller no puede borrar el registro
  -- de lo que se le cobró. Por eso el nombre va congelado en su propia columna,
  -- y el historial lo sigue mostrando aunque el seller ya no exista.
  idseller   INTEGER REFERENCES seller(id) ON DELETE SET NULL,
  seller     VARCHAR(150) NOT NULL,
  desde      DATE NOT NULL,
  hasta      DATE NOT NULL,
  cantidad   INTEGER NOT NULL DEFAULT 0,
  total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_factura_rango CHECK (desde <= hasta)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_public_id ON factura(public_id);
-- El historial siempre pide "las últimas N de este seller".
CREATE INDEX IF NOT EXISTS idx_factura_empresa_fecha ON factura(idempresa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factura_idseller ON factura(idseller);

CREATE TABLE factura_detalle (
  id            SERIAL PRIMARY KEY,
  idfactura     INTEGER NOT NULL REFERENCES factura(id) ON DELETE CASCADE,
  idpaquete     INTEGER REFERENCES paquete(id) ON DELETE SET NULL,
  idenvioml     VARCHAR(50),
  direccion     TEXT,
  fechaentrega  TIMESTAMPTZ,
  -- El espejo del `seller` que guarda liquidacion_detalle: en una factura la
  -- otra punta del paquete es quien lo entregó.
  transportista VARCHAR(150),
  zona          VARCHAR(100),
  importe       NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_factura_detalle_idfactura ON factura_detalle(idfactura);

-- RLS: activo y sin policies (la API usa service role, que lo bypassea).
ALTER TABLE factura         ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura         FORCE  ROW LEVEL SECURITY;
ALTER TABLE factura_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE factura_detalle FORCE  ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT seller, desde, hasta, cantidad, total FROM factura ORDER BY created_at DESC;
