-- Preparación para alto volumen de paquetes.
--
-- Hasta ahora varias pantallas traían TODOS los paquetes de la empresa a la
-- Serverless Function y los contaban en JavaScript (Sellers, Transportistas,
-- Inicio, Estadísticas, el asistente). Con miles de paquetes por día eso:
--   1. se vuelve lento y caro (cada request mueve la tabla entera), y
--   2. da resultados INCORRECTOS en silencio: PostgREST devuelve como máximo
--      1000 filas por consulta (max-rows de Supabase), así que los conteos y
--      montos se cortaban sin avisar.
--
-- Esta migración:
--   a) agrega los índices que usan los listados filtrados y paginados;
--   b) crea dos funciones que hacen los conteos/montos dentro de Postgres y
--      devuelven pocas filas ya agregadas.
--
-- Requiere migration-estado-paquete.sql (estado canónico con CHECK): las
-- funciones comparan el estado por igualdad.
--
-- Correr en Supabase → SQL Editor. Es idempotente.
--
-- OJO en producción con la tabla ya grande: CREATE INDEX bloquea las
-- escrituras de paquete mientras se construye. Si la tabla ya tiene cientos de
-- miles de filas, correr cada CREATE INDEX por separado como
-- CREATE INDEX CONCURRENTLY (fuera de una transacción).

-- ──────────────────────────────────────────────────────────────────────────
-- a) Índices
-- ──────────────────────────────────────────────────────────────────────────

-- Listado de Paquetes de la empresa, ordenado por fecha de ingreso, con o sin
-- filtro por estado / seller / transportista.
CREATE INDEX IF NOT EXISTS idx_paquete_empresa_fechaingreso
  ON paquete (idempresa, fechaingreso DESC);
CREATE INDEX IF NOT EXISTS idx_paquete_empresa_estado_fecha
  ON paquete (idempresa, estado, fechaingreso DESC);
CREATE INDEX IF NOT EXISTS idx_paquete_empresa_seller_fecha
  ON paquete (idempresa, idseller, fechaingreso DESC);
CREATE INDEX IF NOT EXISTS idx_paquete_empresa_transp_fecha
  ON paquete (idempresa, idtransportista, fechaingreso DESC);

-- Pantalla del transportista: sus paquetes abiertos (Ingresado / En camino).
CREATE INDEX IF NOT EXISTS idx_paquete_transp_estado_fecha
  ON paquete (idtransportista, estado, fechaingreso DESC);

-- Facturas y liquidaciones: paquetes entregados en un rango de fechas.
CREATE INDEX IF NOT EXISTS idx_paquete_empresa_fechaentrega
  ON paquete (idempresa, fechaentrega)
  WHERE fechaentrega IS NOT NULL;

-- Usuarios de una empresa por rol (transportistas).
CREATE INDEX IF NOT EXISTS idx_usuario_empresa_rol ON usuario (idempresa, rol);

-- Búsqueda por texto en el listado de Paquetes (ID de envío, comprador,
-- dirección): ILIKE '%texto%' no puede usar un btree; con trigramas sí.
-- En el esquema "extensions" y no en "public": es lo que recomienda Supabase
-- (su linter marca como advertencia de seguridad las extensiones en public).
-- Si ya estaba instalada en public, esta línea no hace nada y los índices de
-- abajo la usan igual.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

DO $$
BEGIN
  -- El operador de clase vive en "extensions" (o en public si la extensión ya
  -- estaba ahí): se agregan los dos al search_path solo para este bloque.
  PERFORM set_config('search_path', 'public, extensions', true);
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_paquete_comprador_trgm ON paquete USING gin (comprador gin_trgm_ops)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_paquete_direccion_trgm ON paquete USING gin (direccion gin_trgm_ops)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_paquete_idenvioml_trgm ON paquete USING gin (idenvioml gin_trgm_ops)';
EXCEPTION WHEN others THEN
  -- Si alguna columna no es de texto el índice no aplica; la búsqueda funciona
  -- igual, solo que sin acelerar.
  RAISE NOTICE 'Índices de trigramas no creados: %', SQLERRM;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- b) Funciones de agregación
-- ──────────────────────────────────────────────────────────────────────────

-- Paquetes por estado y monto de los entregados, por seller o transportista.
--
--   p_tipo = 'seller'        → agrupa por paquete.idseller, valoriza con
--                              seller.idlista (lista de PRECIOS)
--   p_tipo = 'transportista' → agrupa por paquete.idtransportista, valoriza
--                              con usuario.idlista_costo (lista de COSTOS)
--
-- La zona de cada paquete se resuelve igual que _lib/zonas.js:
--   lista_area_zona (override de la lista) → area_flex.idzona (default de la
--   empresa) → paquete.idzona (la que quedó al escanear).
--
-- Primero se agrega por (entidad, estado, barrio, zona) y recién después se
-- cruza con las listas: los joins trabajan sobre cientos de filas, no sobre
-- todos los paquetes.
CREATE OR REPLACE FUNCTION resumen_paquetes_por_entidad(p_idempresa bigint, p_tipo text)
RETURNS TABLE (
  identidad     bigint,
  totales       bigint,
  en_camino     bigint,
  entregados    bigint,
  cancelados    bigint,
  reprogramados bigint,
  monto         numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH agregado AS (
    SELECT
      (CASE WHEN p_tipo = 'seller' THEN p.idseller ELSE p.idtransportista END)::bigint AS identidad,
      p.estado::text  AS estado,
      p.idarea::bigint AS idarea,
      p.idzona::bigint AS idzona,
      count(*)         AS n
    FROM paquete p
    WHERE p.idempresa = p_idempresa
      AND (CASE WHEN p_tipo = 'seller' THEN p.idseller ELSE p.idtransportista END) IS NOT NULL
    GROUP BY 1, 2, 3, 4
  ),
  con_lista AS (
    SELECT
      a.*,
      (CASE WHEN p_tipo = 'seller' THEN s.idlista ELSE u.idlista_costo END)::bigint AS idlista
    FROM agregado a
    LEFT JOIN seller  s ON p_tipo = 'seller'  AND s.id = a.identidad
    LEFT JOIN usuario u ON p_tipo <> 'seller' AND u.id = a.identidad
  )
  SELECT
    c.identidad,
    sum(c.n)::bigint,
    coalesce(sum(c.n) FILTER (WHERE c.estado = 'En camino'), 0)::bigint,
    coalesce(sum(c.n) FILTER (WHERE c.estado = 'Entregado'), 0)::bigint,
    coalesce(sum(c.n) FILTER (WHERE c.estado = 'Cancelado'), 0)::bigint,
    coalesce(sum(c.n) FILTER (WHERE c.estado = 'Reprogramado'), 0)::bigint,
    coalesce(sum(c.n * t.importe) FILTER (WHERE c.estado = 'Entregado'), 0)::numeric
  FROM con_lista c
  LEFT JOIN area_flex         af  ON af.id = c.idarea
  LEFT JOIN lista_area_zona   laz ON laz.idlista = c.idlista AND laz.idarea = c.idarea
  LEFT JOIN lista_zona_tarifa t   ON t.idlista = c.idlista
                                 AND t.idzona = coalesce(laz.idzona, af.idzona, c.idzona)
  GROUP BY c.identidad;
$$;

-- Cantidad de paquetes por (barrio, estado) con los mismos filtros que el
-- listado de Paquetes. Alimenta Estadísticas (agrupado por partido) e Inicio
-- (sumado por estado). Devuelve a lo sumo barrios × estados filas.
CREATE OR REPLACE FUNCTION estadisticas_paquetes(
  p_idempresa       bigint,
  p_idseller        bigint      DEFAULT NULL,
  p_idtransportista bigint      DEFAULT NULL,
  p_estado          text        DEFAULT NULL,
  p_desde           timestamptz DEFAULT NULL,
  p_hasta           timestamptz DEFAULT NULL
)
RETURNS TABLE (idarea bigint, estado text, cantidad bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.idarea::bigint, p.estado::text, count(*)::bigint
  FROM paquete p
  WHERE p.idempresa = p_idempresa
    AND (p_idseller        IS NULL OR p.idseller        = p_idseller)
    AND (p_idtransportista IS NULL OR p.idtransportista = p_idtransportista)
    AND (p_estado          IS NULL OR p.estado          = p_estado)
    AND (p_desde           IS NULL OR p.fechaingreso   >= p_desde)
    AND (p_hasta           IS NULL OR p.fechaingreso   <= p_hasta)
  GROUP BY 1, 2;
$$;

-- Solo las llama la API con la service role. Por defecto Postgres le da
-- EXECUTE a PUBLIC, y PostgREST las expondría como /rpc/... a cualquiera con
-- la anon key, que podría pedir los números de otra empresa.
REVOKE ALL ON FUNCTION resumen_paquetes_por_entidad(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION estadisticas_paquetes(bigint, bigint, bigint, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resumen_paquetes_por_entidad(bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION estadisticas_paquetes(bigint, bigint, bigint, text, timestamptz, timestamptz)
  TO service_role;

-- Que el planificador conozca los índices nuevos desde ya.
ANALYZE paquete;
