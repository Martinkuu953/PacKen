import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  console.warn('[PacKen] ⚠️  JWT_SECRET no configurado en backend/.env — el login no va a funcionar.');
}

// ── Contraseñas ───────────────────────────────────────────────────────────
export function hashearContrasena(plano) {
  return bcrypt.hash(plano, 10);
}

export function compararContrasena(plano, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plano, hash);
}

// ── Tokens JWT ────────────────────────────────────────────────────────────
// El payload identifica al usuario y su rol ('seller' | 'transportista').
export function firmarToken(payload) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verificarToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado');
  return jwt.verify(token, JWT_SECRET);
}
