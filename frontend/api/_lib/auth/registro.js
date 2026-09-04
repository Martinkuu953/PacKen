import { getSupabase } from '../ml.js';
import { hashPassword, generateToken, perfilPublico, validarPassword, validarEmail } from '../auth.js';
import { crearRefreshToken } from '../refreshTokens.js';
import { setRefreshCookie } from '../cookies.js';
import { responderError } from '../errores.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nombre, email, password, rol } = req.body ?? {};

    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, password y rol son requeridos' });
    }
    // El registro público es solo para empresas. Las cuentas de transportista
    // las crea la empresa desde su panel (POST /api/transportistas): un
    // transportista no puede darse de alta solo.
    if (rol !== 'empresa') {
      return res.status(403).json({
        error: 'Solo las empresas pueden registrarse. Pedile a tu empresa que te cree la cuenta.',
      });
    }

    const errorEmail = validarEmail(email);
    if (errorEmail) return res.status(400).json({ error: errorEmail });

    const errorPassword = validarPassword(password);
    if (errorPassword) return res.status(400).json({ error: errorPassword });

    if (String(nombre).trim().length < 2) {
      return res.status(400).json({ error: 'El nombre es demasiado corto' });
    }

    const supabase = getSupabase();
    const hash = hashPassword(password);

    const { data, error } = await supabase
      .from('usuario')
      .insert({
        nombre,
        email: email.toLowerCase().trim(),
        password: hash,
        dni: null,
        rol: 'empresa',
        idempresa: null,
        estado_solicitud: null,
      })
      .select('id, public_id, nombre, rol, idempresa, estado_solicitud')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El email o DNI ya está registrado' });
      }
      throw new Error(error.message);
    }

    const token = generateToken(data);
    const { token: refreshToken, expiresAt } = await crearRefreshToken(supabase, data.id);
    setRefreshCookie(res, refreshToken, expiresAt);
    return res.status(201).json({ usuario: perfilPublico(data), token });
  } catch (err) {
    return responderError(res, err, 400, 'registro');
  }
}
