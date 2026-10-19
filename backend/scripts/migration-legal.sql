-- Constancia de aceptación de Términos y Política de privacidad.
--
-- Al registrarse, la empresa tiene que aceptar los Términos y la Política de
-- privacidad y declarar que sus datos son verdaderos. Se guarda cuándo y qué
-- versión aceptó: es la prueba del consentimiento que pide la Ley 25.326 y lo
-- que permite saber quién tiene que volver a aceptar si los textos cambian.
--
-- Correr en Supabase → SQL Editor ANTES de desplegar el código que la usa
-- (/api/auth/registro guarda estas columnas). Es idempotente.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS terminos_version      VARCHAR(20);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS terminos_aceptados_en TIMESTAMPTZ;
