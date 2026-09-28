-- Los tokens de Mercado Libre ahora se guardan cifrados (ver
-- frontend/api/_lib/cifrado.js): "enc:v1:" + base64, bastante más largos que
-- el token en claro. Si las columnas eran VARCHAR con tope, el UPDATE del
-- token cifrado fallaría. TEXT no tiene tope y no reescribe nada existente.
--
-- Ejecutar en Supabase → SQL Editor ANTES de configurar ML_TOKEN_KEY en Vercel.

ALTER TABLE meli_token ALTER COLUMN access_token  TYPE TEXT;
ALTER TABLE meli_token ALTER COLUMN refresh_token TYPE TEXT;
