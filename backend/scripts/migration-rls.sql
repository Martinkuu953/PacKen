-- Activa Row Level Security (RLS) en todas las tablas.
--
-- Por qué: la publishable/anon key de Supabase viaja en el cliente y es
-- pública por diseño. Solo es segura si RLS está ACTIVO. Sin RLS, cualquiera
-- con esa key puede leer/escribir toda la base vía la REST API de Supabase
-- (usuario => hashes de password, meli_token => tokens de MercadoLibre, etc).
--
-- La API de PacKen usa la SERVICE ROLE key del lado servidor, que BYPASSA RLS.
-- Por eso alcanza con activar RLS y NO crear policies: el backend sigue
-- funcionando y el anon/cliente queda sin acceso directo.
--
-- Ejecutar en Supabase → SQL Editor.

BEGIN;

ALTER TABLE usuario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario         FORCE  ROW LEVEL SECURITY;

ALTER TABLE paquete         ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquete         FORCE  ROW LEVEL SECURITY;

ALTER TABLE seller          ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller          FORCE  ROW LEVEL SECURITY;

ALTER TABLE meli_token      ENABLE ROW LEVEL SECURITY;
ALTER TABLE meli_token      FORCE  ROW LEVEL SECURITY;

ALTER TABLE refresh_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens  FORCE  ROW LEVEL SECURITY;

COMMIT;

-- Verificación: todas deben mostrar rowsecurity = true.
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- OJO: si tenés otras tablas (zona, etc.), activales RLS también. Para listar
-- las que AÚN NO lo tienen:
-- SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
