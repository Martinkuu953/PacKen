import crypto from 'crypto';
import { query } from '../lib/db.js';

const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function nuevaExpiracion() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function crearRefreshToken(usuarioId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = nuevaExpiracion();
  await query(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [usuarioId, hash(token), expiresAt],
  );
  return { token, expiresAt };
}

export async function rotarRefreshToken(tokenPlano) {
  const tokenHash = hash(tokenPlano);
  const { rows } = await query(
    'SELECT id, usuario_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash],
  );
  const fila = rows[0];

  if (!fila) return { status: 'invalid' };

  if (fila.revoked_at) {
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE usuario_id = $1 AND revoked_at IS NULL',
      [fila.usuario_id],
    );
    return { status: 'reused' };
  }

  if (new Date(fila.expires_at) < new Date()) {
    return { status: 'expired' };
  }

  const { token: nuevoToken, expiresAt } = await crearRefreshToken(fila.usuario_id);
  const nuevaFila = await query('SELECT id FROM refresh_tokens WHERE token_hash = $1', [hash(nuevoToken)]);
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $1 WHERE id = $2',
    [nuevaFila.rows[0].id, fila.id],
  );

  return { status: 'ok', usuarioId: fila.usuario_id, token: nuevoToken, expiresAt };
}

export async function revocarRefreshToken(tokenPlano) {
  if (!tokenPlano) return;
  await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hash(tokenPlano)],
  );
}
