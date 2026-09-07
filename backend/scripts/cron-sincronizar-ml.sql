-- Cron de sincronización con Mercado Libre, corriendo DENTRO de Supabase.
--
-- ¿Por qué acá y no con "crons" en vercel.json? Porque el plan Hobby de Vercel
-- limita los cron jobs a UNA ejecución por día, y lo que necesitamos es
-- revisar los paquetes durante toda la jornada. pg_cron no tiene ese límite.
--
-- Correr esto en Supabase → SQL Editor, DESPUÉS de migration-sync-ml.sql y
-- después de haber desplegado la API con el endpoint /api/paquetes/sincronizar.

-- 1) Extensiones. pg_net permite hacer HTTP desde Postgres; pg_cron agenda.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) El secreto compartido con la API.
--    Va en Vault y no escrito en la definición del job: cualquiera con acceso
--    de lectura a la tabla cron.job puede ver el comando en texto plano.
--    Tiene que ser EXACTAMENTE el mismo valor que la variable de entorno
--    CRON_SECRET en Vercel. Generalo con: openssl rand -hex 32
SELECT vault.create_secret(
  'PEGAR_ACA_EL_MISMO_VALOR_QUE_CRON_SECRET_EN_VERCEL',
  'packen_cron_secret',
  'Secreto para llamar a /api/paquetes/sincronizar'
);

-- 3) El job. Cada 15 minutos: suficiente para que un "entregado" aparezca en
--    el panel casi en el momento, sin quemar la cuota de la API de ML.
--    Reemplazar la URL si el dominio de producción es otro.
SELECT cron.schedule(
  'packen-sincronizar-ml',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://packen.vercel.app/api/paquetes/sincronizar',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (SELECT decrypted_secret
                          FROM vault.decrypted_secrets
                         WHERE name = 'packen_cron_secret')
    ),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);


-- ──────────────────────────────────────────────────────────────────────────
-- Operación
-- ──────────────────────────────────────────────────────────────────────────

-- Ver el job agendado:
--   SELECT jobid, jobname, schedule, active FROM cron.job;

-- Ver las últimas corridas (status = 'succeeded' significa que el POST salió,
-- no que la sincronización haya andado: eso está en los logs de Vercel):
--   SELECT runid, status, return_message, start_time
--     FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'packen-sincronizar-ml')
--    ORDER BY start_time DESC
--    LIMIT 20;

-- Ver la respuesta que devolvió la API (pg_net guarda el body):
--   SELECT id, status_code, content, created
--     FROM net._http_response
--    ORDER BY created DESC
--    LIMIT 20;

-- Cambiar la frecuencia (re-agendar con el mismo nombre lo pisa):
--   SELECT cron.schedule('packen-sincronizar-ml', '*/30 * * * *', $$ ... $$);

-- Apagarlo:
--   SELECT cron.unschedule('packen-sincronizar-ml');

-- Rotar el secreto (además de cambiar CRON_SECRET en Vercel):
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'packen_cron_secret'),
--     'NUEVO_VALOR'
--   );
