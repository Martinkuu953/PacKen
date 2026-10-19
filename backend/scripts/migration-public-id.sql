-- Identificador público opaco para el JWT.
--
-- Antes, el access token llevaba el id interno (SERIAL) del usuario en el
-- payload. Un JWT no está cifrado: cualquiera que abra devtools puede hacer
-- atob() del payload y leerlo. Un id secuencial expuesto sirve para enumerar
-- usuarios y para adivinar los ids de los demás.
--
-- Ahora el token lleva solo { sub: <public_id> }, un UUID sin significado, y
-- el id interno se resuelve contra esta tabla en cada request. El id nunca
-- sale del servidor.
--
-- Ejecutar en Supabase → SQL Editor.

BEGIN;

-- gen_random_uuid() es volátil: Postgres calcula un valor distinto por fila,
-- así que los usuarios existentes quedan con UUIDs únicos.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS public_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_public_id ON usuario(public_id);

COMMIT;

-- Nota: al aplicar esta migración, los access tokens ya emitidos dejan de
-- validar (no tienen sub). Los clientes con sesión abierta hacen un refresh
-- automático contra la cookie httpOnly y siguen andando; no hace falta que
-- nadie vuelva a loguearse.
