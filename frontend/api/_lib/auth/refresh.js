import { getSupabase } from '../ml.js';
import { generateToken, perfilPublico } from '../auth.js';
import { rotarRefreshToken } from '../refreshTokens.js';
import { getRefreshCookie, setRefreshCookie, clearRefreshCookie } from '../cookies.js';
import { responderError } from '../errores.js';

// POST /api/auth/refresh — rota el refresh token de la cookie y emite un
// access token nuevo. Responde { usuario, token } igual que login.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tokenActual = getRefreshCookie(req);
  if (!tokenActual) {
    return res.status(401).json({ error: 'Refresh token requerido' });
  }

  try {
    const supabase = getSupabase();
    const resultado = await rotarRefreshToken(supabase, tokenActual);

    if (resultado.status !== 'ok') {
      clearRefreshCookie(res);
      const mensajes = {
        invalid: 'Refresh token inválido',
        expired: 'Refresh token expirado',
        reused: 'Sesión inválida, iniciá sesión nuevamente',
      };
      return res.status(401).json({ error: mensajes[resultado.status] });
    }

    const { data: usuario, error } = await supabase
      .from('usuario')
      .select('public_id, nombre, rol, estado_solicitud')
      .eq('id', resultado.usuarioId)
      .single();

    if (error || !usuario) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    setRefreshCookie(res, resultado.token, resultado.expiresAt);
    const token = generateToken(usuario);
    return res.json({ usuario: perfilPublico(usuario), token });
  } catch (err) {
    clearRefreshCookie(res);
    return responderError(res, err, 401, 'refresh');
  }
}
