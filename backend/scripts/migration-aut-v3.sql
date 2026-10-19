-- Correcciones del AUT v2 + historial. Ejecutar UNA vez en Supabase → SQL Editor,
-- ANTES de desplegar el código que lo usa.
--
--   1) paquete.public_id           → N-02: el id secuencial deja de salir de la API.
--   2) paquete_historial           → historial de estados de cada paquete.
--   3) lista_historial             → historial de cambios en listas de precios/costos.
--   4) Nombre de lista único       → no más "Lista Nul" y "Lista Nul" en la misma empresa.
--   5) intento_auth                → C-04: rate limiting de login y registro.
--
-- Requiere migration-listas-flex.sql y migration-public-id.sql ya aplicadas.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1) paquete.public_id
-- ──────────────────────────────────────────────────────────────────────────
-- Mismo patrón que usuario/seller/lista: UUID opaco para el cliente, el id
-- SERIAL queda solo dentro del servidor.
ALTER TABLE paquete
  ADD COLUMN IF NOT EXISTS public_id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_paquete_public_id ON paquete(public_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2) Historial de estados de paquete
-- ──────────────────────────────────────────────────────────────────────────
-- Lo escribe un trigger, no el código: así queda registrado todo cambio de
-- estado venga de donde venga (botón, escaneo, webhook de ML, sync). El código
-- solo informa QUIÉN y POR DÓNDE, seteando estas dos columnas en el mismo
-- UPDATE que cambia el estado.
ALTER TABLE paquete ADD COLUMN IF NOT EXISTS ultimo_cambio_por    INTEGER REFERENCES usuario(id) ON DELETE SET NULL;
ALTER TABLE paquete ADD COLUMN IF NOT EXISTS ultimo_cambio_origen VARCHAR(30);

CREATE TABLE IF NOT EXISTS paquete_historial (
  id               BIGSERIAL PRIMARY KEY,
  idpaquete        INTEGER NOT NULL REFERENCES paquete(id) ON DELETE CASCADE,
  estado_anterior  VARCHAR(30),
  estado_nuevo     VARCHAR(30) NOT NULL,
  idusuario        INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
  -- 'manual' | 'entrega_masiva' | 'escaneo_colecta' | 'escaneo_reparto' |
  -- 'webhook_ml' | 'sync_ml' | NULL (cambio hecho a mano en la base)
  origen           VARCHAR(30),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paquete_historial_idpaquete ON paquete_historial(idpaquete, created_at);

CREATE OR REPLACE FUNCTION registrar_historial_paquete() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO paquete_historial (idpaquete, estado_anterior, estado_nuevo, idusuario, origen)
    VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.estado END,
      NEW.estado,
      NEW.ultimo_cambio_por,
      NEW.ultimo_cambio_origen
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paquete_historial ON paquete;
CREATE TRIGGER trg_paquete_historial
  AFTER INSERT OR UPDATE OF estado ON paquete
  FOR EACH ROW EXECUTE FUNCTION registrar_historial_paquete();

-- ──────────────────────────────────────────────────────────────────────────
-- 3) Historial de listas de precios/costos
-- ──────────────────────────────────────────────────────────────────────────
-- Nombres de lista y zona se guardan como texto: el historial tiene que seguir
-- leyéndose aunque la lista o la zona se borren después.
CREATE TABLE IF NOT EXISTS lista_historial (
  id               BIGSERIAL PRIMARY KEY,
  idempresa        INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  idlista          INTEGER REFERENCES lista(id) ON DELETE SET NULL,
  tipo             VARCHAR(10) NOT NULL,
  -- 'crear' | 'renombrar' | 'borrar' | 'tarifa'
  accion           VARCHAR(20) NOT NULL,
  lista_nombre     VARCHAR(100),
  nombre_anterior  VARCHAR(100),
  zona_nombre      VARCHAR(100),
  importe_anterior NUMERIC(12,2),
  importe_nuevo    NUMERIC(12,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lista_historial_empresa ON lista_historial(idempresa, tipo, created_at DESC);

CREATE OR REPLACE FUNCTION registrar_historial_lista() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO lista_historial (idempresa, idlista, tipo, accion, lista_nombre)
    VALUES (NEW.idempresa, NEW.id, NEW.tipo, 'crear', NEW.nombre);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.nombre IS DISTINCT FROM OLD.nombre THEN
      INSERT INTO lista_historial (idempresa, idlista, tipo, accion, lista_nombre, nombre_anterior)
      VALUES (NEW.idempresa, NEW.id, NEW.tipo, 'renombrar', NEW.nombre, OLD.nombre);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- idlista NULL: la fila de lista ya no existe cuando corre el AFTER DELETE.
    INSERT INTO lista_historial (idempresa, idlista, tipo, accion, lista_nombre)
    VALUES (OLD.idempresa, NULL, OLD.tipo, 'borrar', OLD.nombre);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_historial ON lista;
CREATE TRIGGER trg_lista_historial
  AFTER INSERT OR UPDATE OF nombre OR DELETE ON lista
  FOR EACH ROW EXECUTE FUNCTION registrar_historial_lista();

CREATE OR REPLACE FUNCTION registrar_historial_tarifa() RETURNS trigger AS $$
DECLARE
  l RECORD;
  z_nombre VARCHAR(100);
BEGIN
  -- Las tarifas en 0 que se siembran al crear una lista o una zona no son un
  -- cambio de precio: se omiten.
  IF TG_OP = 'INSERT' AND NEW.importe = 0 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.importe IS NOT DISTINCT FROM OLD.importe THEN RETURN NEW; END IF;

  SELECT id, idempresa, tipo, nombre INTO l FROM lista WHERE id = NEW.idlista;
  SELECT nombre INTO z_nombre FROM zona WHERE id = NEW.idzona;

  INSERT INTO lista_historial
    (idempresa, idlista, tipo, accion, lista_nombre, zona_nombre, importe_anterior, importe_nuevo)
  VALUES
    (l.idempresa, l.id, l.tipo, 'tarifa', l.nombre, z_nombre,
     CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.importe END, NEW.importe);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tarifa_historial ON lista_zona_tarifa;
CREATE TRIGGER trg_tarifa_historial
  AFTER INSERT OR UPDATE OF importe ON lista_zona_tarifa
  FOR EACH ROW EXECUTE FUNCTION registrar_historial_tarifa();

-- ──────────────────────────────────────────────────────────────────────────
-- 4) Nombre de lista único por empresa y tipo (sin distinguir mayúsculas)
-- ──────────────────────────────────────────────────────────────────────────
-- Antes de crear el índice se desduplican los nombres que ya existan:
-- "Lista Nul", "Lista Nul" → "Lista Nul", "Lista Nul (2)".
UPDATE lista l
SET nombre = l.nombre || ' (' || d.n || ')'
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY idempresa, tipo, lower(btrim(nombre)) ORDER BY id) AS n
  FROM lista
) d
WHERE d.id = l.id AND d.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lista_nombre
  ON lista (idempresa, tipo, lower(btrim(nombre)));

-- ──────────────────────────────────────────────────────────────────────────
-- 5) Rate limiting de login/registro
-- ──────────────────────────────────────────────────────────────────────────
-- Una fila por intento fallido (login) o por intento (registro). La clave es
-- 'login:ip:<ip>', 'login:id:<email|dni>' o 'registro:ip:<ip>'.
CREATE TABLE IF NOT EXISTS intento_auth (
  id         BIGSERIAL PRIMARY KEY,
  clave      VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intento_auth_clave ON intento_auth(clave, created_at);

-- RLS: activo y sin policies, igual que el resto (la API usa service role).
ALTER TABLE paquete_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquete_historial FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista_historial   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_historial   FORCE  ROW LEVEL SECURITY;
ALTER TABLE intento_auth      ENABLE ROW LEVEL SECURITY;
ALTER TABLE intento_auth      FORCE  ROW LEVEL SECURITY;

COMMIT;
