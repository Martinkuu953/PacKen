-- Historial de listas por lista. Ejecutar UNA vez en Supabase → SQL Editor,
-- después de migration-aut-v3.sql.
--
-- El panel de listas dejó de mostrar el historial de todas juntas: cada lista
-- muestra el suyo (GET /api/precios?historial=<listaId>). Esa consulta filtra
-- por idlista y ordena por fecha, así que necesita su propio índice; el de
-- (idempresa, tipo, created_at) no le sirve.
CREATE INDEX IF NOT EXISTS idx_lista_historial_lista ON lista_historial(idlista, created_at DESC);
