import { getSupabase } from '../ml.js';
import { comparePassword, generateToken, perfilPublico } from '../auth.js';
import { crearRefreshToken } from '../refreshTokens.js';
import { setRefreshCookie } from '../cookies.js';
import { responderError } from '../errores.js';
import { LIMITES, ipDe, verificarLimites, registrarIntento, limpiarIntentos } from '../rateLimit.js';

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
    const ident = esDNI ? String(identificador) : String(identificador).toLowerCase().trim();

    // C-04: se cuenta por cuenta y por IP. La de cuenta frena el ataque a un
    // usuario puntual; la de IP, el que prueba muchas cuentas desde un lugar.
    const claveCuenta = `login:id:${ident}`;
    const claveIp = `login:ip:${ipDe(req)}`;
    await verificarLimites(supabase, [
      { clave: claveCuenta, ...LIMITES.loginPorCuenta },
      { clave: claveIp, ...LIMITES.loginPorIp },
    ]);

    const { data: usuario, error } = await supabase
      .from('usuario')
      .select('*')
      .eq(esDNI ? 'dni' : 'email', ident)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!usuario || !comparePassword(password, usuario.password)) {
      await registrarIntento(supabase, [claveCuenta, claveIp]);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await limpiarIntentos(supabase, claveCuenta);

    const token = generateToken(usuario);
    const { token: refreshToken, expiresAt } = await crearRefreshToken(supabase, usuario.id);
    setRefreshCookie(res, refreshToken, expiresAt);
    return res.json({ usuario: perfilPublico(usuario), token });
  } catch (err) {
    return responderError(res, err, 401, 'login');
  }
}
