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

// Borra los tokens ya vencidos del usuario para que la tabla no crezca sin
// límite. Los revocados pero NO vencidos se conservan: son justamente los que
// permiten detectar el reuso de un token robado.
async function limpiarVencidos(supabase, usuarioId) {
  const { error } = await supabase
    .from('refresh_tokens')
    .delete()
    .eq('usuario_id', usuarioId)
    .lt('expires_at', new Date().toISOString());

  // Best-effort: si falla, la sesión igual es válida. Solo lo logueamos.
  if (error) console.warn('[PacKen] No se pudieron limpiar refresh tokens vencidos:', error.message);
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
    const { error: revErr } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('usuario_id', fila.usuario_id)
      .is('revoked_at', null);

    // Si no pudimos cortar las sesiones, no podemos responder "todo bien":
    // el token robado seguiría sirviendo.
    if (revErr) throw new Error(revErr.message);
    return { status: 'reused' };
  }

  if (new Date(fila.expires_at) < new Date()) {
    return { status: 'expired' };
  }

  const nuevo = await crearRefreshToken(supabase, fila.usuario_id);

  const { error: rotErr } = await supabase
    .from('refresh_tokens')
    .update({ revoked_at: new Date().toISOString(), replaced_by: nuevo.id })
    .eq('id', fila.id);

  // Sin este chequeo, un fallo acá dejaba el token viejo válido para siempre
  // en paralelo al nuevo: rotación que no rota. Mejor abortar y que el
  // handler limpie la cookie.
  if (rotErr) throw new Error(rotErr.message);

  await limpiarVencidos(supabase, fila.usuario_id);

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
