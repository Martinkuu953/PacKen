// Refresh tokens de sesión: opacos (no JWT), guardados hasheados en la tabla
// refresh_tokens, con rotación en cada uso y detección de reuso (un token ya
// rotado que vuelve a usarse revoca toda la sesión del usuario).

import crypto from 'crypto';

const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function nuevaExpiracion() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function crearRefreshToken(supabase, usuarioId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = nuevaExpiracion();

  const { data, error } = await supabase
    .from('refresh_tokens')
    .insert({ usuario_id: usuarioId, token_hash: hash(token), expires_at: expiresAt.toISOString() })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return { token, expiresAt, id: data.id };
}

export async function rotarRefreshToken(supabase, tokenPlano) {
  const { data: fila, error } = await supabase
    .from('refresh_tokens')
    .select('id, usuario_id, expires_at, revoked_at')
    .eq('token_hash', hash(tokenPlano))
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!fila) return { status: 'invalid' };

  if (fila.revoked_at) {
    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('usuario_id', fila.usuario_id)
      .is('revoked_at', null);
    return { status: 'reused' };
  }

  if (new Date(fila.expires_at) < new Date()) {
    return { status: 'expired' };
  }

  const nuevo = await crearRefreshToken(supabase, fila.usuario_id);
  await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString(), replaced_by: nuevo.id })
    .eq('id', fila.id);

  return { status: 'ok', usuarioId: fila.usuario_id, token: nuevo.token, expiresAt: nuevo.expiresAt };
}

export async function revocarRefreshToken(supabase, tokenPlano) {
  if (!tokenPlano) return;
  await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', hash(tokenPlano))
    .is('revoked_at', null);
}
