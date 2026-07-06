import { getSupabase } from '../ml.js';
import { comparePassword, generateToken } from '../auth.js';
import { crearRefreshToken } from '../refreshTokens.js';
import { setRefreshCookie } from '../cookies.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { identificador, password } = req.body ?? {};

    if (!identificador || !password) {
      return res.status(400).json({ error: 'identificador y password son requeridos' });
    }

    const supabase = getSupabase();
    const esDNI = /^\d+$/.test(identificador);

    const { data: usuario, error } = await supabase
      .from('usuario')
      .select('*')
      .eq(esDNI ? 'dni' : 'email', esDNI ? identificador : identificador.toLowerCase().trim())
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (!comparePassword(password, usuario.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(usuario);
    const { token: refreshToken, expiresAt } = await crearRefreshToken(supabase, usuario.id);
    setRefreshCookie(res, refreshToken, expiresAt);
    const { password: _, ...safe } = usuario;
    return res.json({ usuario: safe, token });
  } catch (err) {
    console.error('[PacKen] Error en login:', err.message);
    return res.status(401).json({ error: err.message });
  }
}
