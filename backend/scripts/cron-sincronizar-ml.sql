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
--    Si el secreto ya existe lo actualiza (rotación); si no, lo crea. Así este
--    archivo se puede volver a correr entero sin el error de clave duplicada.
DO $$
DECLARE
  nuevo_valor CONSTANT text := 'PEGAR_ACA_EL_MISMO_VALOR_QUE_CRON_SECRET_EN_VERCEL';
  existente uuid;
BEGIN
  -- Sin esto, correr el archivo tal cual está en el repo pisaría el secreto
  -- real con el texto de ejemplo y el cron empezaría a recibir 401.
  IF nuevo_valor LIKE 'PEGAR_ACA%' THEN
    RAISE EXCEPTION 'Reemplazá PEGAR_ACA_... por el valor real de CRON_SECRET antes de correr esto';
  END IF;

  SELECT id INTO existente FROM vault.secrets WHERE name = 'packen_cron_secret';
  IF existente IS NULL THEN
    PERFORM vault.create_secret(
      nuevo_valor,
      'packen_cron_secret',
      'Secreto para llamar a /api/paquetes/sincronizar'
    );
  ELSE
    PERFORM vault.update_secret(existente, nuevo_valor);
  END IF;
END $$;

-- 3) El job. Cada 5 minutos: con alto volumen, cada corrida revisa hasta
--    SYNC_MAX_POR_CORRIDA paquetes (600 por defecto) y salta los que se
--    consultaron hace menos de 10 minutos, así que no se quema la cuota de la
--    API de ML aunque corra seguido.
--    Si el job ya existía con */15, re-ejecutar este cron.schedule con el
--    mismo nombre lo reemplaza.
--    Reemplazar la URL si el dominio de producción es otro.
SELECT cron.schedule(
  'packen-sincronizar-ml',
  '*/5 * * * *',
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
