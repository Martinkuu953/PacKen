-- Listas de precios y de costos, con nombre, monto por zona y miembros.
--
-- Reemplaza el modelo viejo de lista_precios (una fila por seller+zona, con
-- costo y precio juntos). Ahora una "lista" tiene nombre y un monto por
-- zona, y se le agregan/mueven/sacan sellers (o transportistas) sin
-- duplicar tarifas por cada combinación.
--
-- Dos tipos de lista, misma forma, comparten la tabla `lista` (columna
-- `tipo`):
--   'precio' → lo que la empresa le cobra al seller       (miembros: seller)
--   'costo'  → lo que la empresa le paga al transportista (miembros: usuario
--                                                            con rol='transportista')
-- El monto por zona vive en `lista_zona_monto`, misma forma para ambos
-- tipos (el significado depende de lista.tipo).
--
-- Un seller (o transportista) está en una sola lista a la vez: moverlo de
-- lista es upsertear su fila de miembro con el nuevo idlista, nunca hay dos
-- filas para el mismo seller/transportista (UNIQUE sobre idseller /
-- idtransportista, no sobre el par con idlista).
--
-- lista_precios (tabla vieja) queda sin uso: no había datos reales que
-- migrar. No se borra, solo se deja de leer/escribir desde la API.
--
-- Ejecutar en Supabase → SQL Editor. Requiere migration-lista-precios.sql
-- (tabla zona, seller.public_id) y migration-auth.sql (tabla usuario).

BEGIN;

CREATE TABLE IF NOT EXISTS lista (
  id         SERIAL PRIMARY KEY,
  public_id  UUID NOT NULL DEFAULT gen_random_uuid(),
  idempresa  INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo       VARCHAR(10) NOT NULL CHECK (tipo IN ('precio', 'costo')),
  nombre     VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nombres únicos dentro de la misma empresa y el mismo tipo (una lista de
  -- precios y una de costos sí pueden compartir nombre).
  CONSTRAINT uq_lista_nombre UNIQUE (idempresa, tipo, nombre)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lista_public_id ON lista(public_id);
CREATE INDEX IF NOT EXISTS idx_lista_idempresa_tipo ON lista(idempresa, tipo);

CREATE TABLE IF NOT EXISTS lista_zona_monto (
  id         SERIAL PRIMARY KEY,
  idlista    INTEGER NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  idzona     INTEGER NOT NULL REFERENCES zona(id)  ON DELETE CASCADE,
  monto      NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lista_zona_monto UNIQUE (idlista, idzona)
);

CREATE INDEX IF NOT EXISTS idx_lista_zona_monto_idlista ON lista_zona_monto(idlista);

CREATE TABLE IF NOT EXISTS lista_miembro_seller (
  id         SERIAL PRIMARY KEY,
  idlista    INTEGER NOT NULL REFERENCES lista(id)  ON DELETE CASCADE,
  idseller   INTEGER NOT NULL REFERENCES seller(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lista_miembro_seller_idseller UNIQUE (idseller)
);

CREATE INDEX IF NOT EXISTS idx_lista_miembro_seller_idlista ON lista_miembro_seller(idlista);

CREATE TABLE IF NOT EXISTS lista_miembro_transportista (
  id              SERIAL PRIMARY KEY,
  idlista         INTEGER NOT NULL REFERENCES lista(id)   ON DELETE CASCADE,
  idtransportista INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_lista_miembro_transportista_idtransportista UNIQUE (idtransportista)
);

CREATE INDEX IF NOT EXISTS idx_lista_miembro_transportista_idlista ON lista_miembro_transportista(idlista);

-- ──────────────────────────────────────────────────────────────────────────
-- Zonas: hoy solo existe id=1 "General" (seed de migration-lista-precios.sql).
-- Arrancamos con Zona 1 / Zona 2 / Zona 3 (zona sigue siendo una tabla real,
-- no queda hardcodeada a 3 en el modelo, solo en este seed inicial).
-- ──────────────────────────────────────────────────────────────────────────
UPDATE zona SET nombre = 'Zona 1' WHERE id = 1 AND nombre = 'General';

INSERT INTO zona (id, nombre, cp_desde, cp_hasta) VALUES
  (2, 'Zona 2', NULL, NULL),
  (3, 'Zona 3', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Insertar ids explícitos no mueve la secuencia; si no la reacomodamos, el
-- próximo INSERT sin id intentaría usar el 2 o el 3 y chocaría.
SELECT setval(
  pg_get_serial_sequence('zona', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM zona), 1), 1)
);

-- Mismo criterio que migration-rls.sql: RLS activo y sin policies. La API
-- usa la service role key (que bypassea RLS); el anon key queda sin acceso.
ALTER TABLE lista                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista                       FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista_zona_monto            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_zona_monto            FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista_miembro_seller        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_miembro_seller        FORCE  ROW LEVEL SECURITY;
ALTER TABLE lista_miembro_transportista ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_miembro_transportista FORCE  ROW LEVEL SECURITY;

COMMIT;
