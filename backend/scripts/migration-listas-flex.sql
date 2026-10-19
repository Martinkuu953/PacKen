-- Listas de precios/costos reutilizables + zonas por empresa armadas desde los
-- barrios/municipios de Mercado Flex.
--
-- Modelo:
--   - zona            : las zonas de la empresa (Zona 1/2/3). Antes era global.
--   - area_flex       : cada "parte" que trae Flex (barrio/municipio) y a qué
--                       zona la mapeó la empresa. Se puebla al escanear paquetes
--                       y/o sincronizando desde la API de Flex.
--   - lista           : lista con nombre (tipo 'precio' o 'costo'), reutilizable.
--   - lista_zona_tarifa: importe por (lista, zona).
--   - seller.idlista / usuario.idlista_costo: a qué lista pertenece cada
--                       seller (precio) / transportista (costo).
--
-- Al escanear, el barrio del envío resuelve area_flex -> zona; con la lista del
-- seller/transportista + esa zona sale el precio/costo.
--
-- Requiere migration-lista-precios.sql (tabla zona) y migration-public-id.sql.
-- Ejecutar en Supabase -> SQL Editor.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1) Zona -> por empresa
-- ──────────────────────────────────────────────────────────────────────────
-- Hasta ahora la zona era global (id=1 'General'). La hacemos por empresa;
-- la fila global id=1 (idempresa NULL) queda como fallback para paquetes sin
-- match de barrio y para no romper paquete.idzona histórico.
ALTER TABLE zona ADD COLUMN IF NOT EXISTS idempresa INTEGER REFERENCES usuario(id) ON DELETE CASCADE;
ALTER TABLE zona ADD COLUMN IF NOT EXISTS orden     INTEGER;

CREATE INDEX IF NOT EXISTS idx_zona_idempresa ON zona(idempresa);

-- Seed: 3 zonas por empresa que todavía no tenga zonas propias.
INSERT INTO zona (idempresa, nombre, orden)
SELECT u.id, z.nombre, z.orden
FROM usuario u
CROSS JOIN (VALUES ('Zona 1', 1), ('Zona 2', 2), ('Zona 3', 3)) AS z(nombre, orden)
WHERE u.rol = 'empresa'
  AND NOT EXISTS (SELECT 1 FROM zona zz WHERE zz.idempresa = u.id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2) area_flex — barrios/municipios de Flex y su mapeo a zona
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS area_flex (
  id         SERIAL PRIMARY KEY,
  public_id  UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa  INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  nombre     VARCHAR(150) NOT NULL,           -- "Palermo", "Belgrano", ...
  ml_ref     VARCHAR(150) NOT NULL,           -- clave de matcheo (id/nombre normalizado del barrio de ML)
  idzona     INTEGER REFERENCES zona(id) ON DELETE SET NULL,  -- NULL = sin asignar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una fila por barrio por empresa: el alta/auto-descubrimiento hace upsert.
  CONSTRAINT uq_area_flex UNIQUE (idempresa, ml_ref)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_area_flex_public_id ON area_flex(public_id);
CREATE INDEX IF NOT EXISTS idx_area_flex_idempresa ON area_flex(idempresa);

-- ──────────────────────────────────────────────────────────────────────────
-- 3) lista — listas reutilizables (precio/costo)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lista (
  id         SERIAL PRIMARY KEY,
  public_id  UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa  INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo       VARCHAR(10) NOT NULL CHECK (tipo IN ('precio', 'costo')),
  nombre     VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_public_id ON lista(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_idempresa_tipo ON lista(idempresa, tipo);

-- ──────────────────────────────────────────────────────────────────────────
-- 4) lista_zona_tarifa — importe por (lista, zona)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lista_zona_tarifa (
  id         SERIAL PRIMARY KEY,
  public_id  UUID NOT NULL DEFAULT gen_random_uuid(),
  idlista    INTEGER NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  idzona     INTEGER NOT NULL REFERENCES zona(id) ON DELETE CASCADE,
  importe    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (importe >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Una tarifa por combinación: el alta hace upsert sobre esta clave.
  CONSTRAINT uq_lista_zona_tarifa UNIQUE (idlista, idzona)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_zona_tarifa_public_id ON lista_zona_tarifa(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_zona_tarifa_idlista ON lista_zona_tarifa(idlista);

-- ──────────────────────────────────────────────────────────────────────────
-- 5) Asignación: una lista por seller (precio) y por transportista (costo)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE seller  ADD COLUMN IF NOT EXISTS idlista       INTEGER REFERENCES lista(id) ON DELETE SET NULL;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS idlista_costo INTEGER REFERENCES lista(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_seller_idlista ON seller(idlista);
CREATE INDEX IF NOT EXISTS idx_usuario_idlista_costo ON usuario(idlista_costo);

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: activo y sin policies (la API usa service role, que lo bypassea).
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE area_flex         ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_flex         FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista             FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista_zona_tarifa ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_zona_tarifa FORCE  ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT idempresa, nombre, orden FROM zona ORDER BY idempresa, orden;
--   SELECT * FROM lista;  SELECT * FROM area_flex;
