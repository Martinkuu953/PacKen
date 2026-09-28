import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifrado en reposo de los tokens de Mercado Libre (tabla meli_token).
//
// Con los tokens en texto plano, cualquier filtración de la base (un backup,
// un export, una key de Supabase expuesta) da acceso directo a las cuentas de
// ML de todos los sellers. Cifrados con una clave que vive solo en las
// variables de entorno, la base sola no alcanza.
//
// Formato: "enc:v1:" + base64(iv[12] | tag[16] | texto cifrado), AES-256-GCM.
// El prefijo permite convivir con filas viejas en texto plano: se leen tal
// cual y quedan cifradas la próxima vez que se guardan (cada renovación de
// token, o con backend/scripts/cifrar-tokens-ml.mjs de una vez).
//
// Lo importan tanto las Serverless Functions como los scripts de backend/.

const PREFIJO = 'enc:v1:';
let avisado = false;

function clave() {
  const hex = process.env.ML_TOKEN_KEY;
  if (!hex) return null;
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error('ML_TOKEN_KEY tiene que ser de 32 bytes en hex (64 caracteres). Generala con: openssl rand -hex 32');
  }
  return buf;
}

export function cifrarToken(texto) {
  if (texto == null) return texto;
  const k = clave();
  if (!k) {
    // Sin clave se sigue guardando en plano para no cortar la integración con
    // ML, pero queda avisado en el log de cada instancia.
    if (!avisado) {
      console.error('[PacKen] ML_TOKEN_KEY no configurada: los tokens de ML se guardan SIN cifrar.');
      avisado = true;
    }
    return texto;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  return PREFIJO + Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString('base64');
}

export function descifrarToken(valor) {
  if (valor == null || !String(valor).startsWith(PREFIJO)) return valor;
  const k = clave();
  if (!k) throw new Error('Hay tokens de ML cifrados pero ML_TOKEN_KEY no está configurada');
  const buf = Buffer.from(String(valor).slice(PREFIJO.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

export function estaCifrado(valor) {
  return valor != null && String(valor).startsWith(PREFIJO);
}
