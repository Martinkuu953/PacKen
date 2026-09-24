import { getSupabase } from '../ml.js';
import { autenticar, comparePassword, hashPassword, validarPassword } from '../auth.js';
import { crearRefreshToken, revocarSesionesDeUsuario } from '../refreshTokens.js';
import { setRefreshCookie } from '../cookies.js';
import { ErrorPublico, responderError } from '../errores.js';

// GET|PATCH /api/auth/perfil — los datos del usuario logueado, y la edición de
// los que puede cambiar solo.
//
// Es el único lugar donde el email sale del servidor. perfilPublico() no lo
// manda a propósito (ver auth.js): ahí el criterio es "lo mínimo que la UI
// necesita para renderizar", y ese perfil viaja en cada login y cada refresh.
// Acá el usuario está pidiendo explícitamente sus propios datos, autenticado,
// para una pantalla que existe justamente para mostrárselos.
//
// El email no se edita: es el identificador con el que se hace login, tiene
// UNIQUE en la tabla, y cambiarlo sin un circuito de verificación deja la
// cuenta apuntando a una casilla que nadie probó que exista.

const CAMPOS_PERFIL = 'nombre, email, dni, rol, estado_solicitud, created_at';

async function ver(res, usuario) {
  // autenticar() resuelve el token pero trae solo los campos de sesión
  // (CAMPOS_SESION), que no incluyen email ni created_at: hace falta ir de nuevo.
  const { data, error } = await getSupabase()
    .from('usuario')
    .select(CAMPOS_PERFIL)
    .eq('id', usuario.id)
    .single();

  if (error) throw new Error(error.message);
  return res.json({ perfil: data });
}

async function editar(req, res, usuario) {
  const { nombre, passwordActual, passwordNueva } = req.body ?? {};
  const supabase = getSupabase();
  const cambios = {};

  if (nombre !== undefined) {
    const limpio = String(nombre).trim();
    if (limpio.length < 2) throw new ErrorPublico('El nombre es demasiado corto');
    if (limpio.length > 255) throw new ErrorPublico('El nombre es demasiado largo');
    cambios.nombre = limpio;
  }

  const cambiaPassword = passwordNueva !== undefined;
  if (cambiaPassword) {
    const errorPassword = validarPassword(passwordNueva);
    if (errorPassword) throw new ErrorPublico(errorPassword);

    // Pedir la contraseña actual es lo que evita que un token robado, o una
    // sesión que quedó abierta en una máquina ajena, se quede con la cuenta.
    const { data: fila, error } = await supabase
      .from('usuario')
      .select('password')
      .eq('id', usuario.id)
      .single();

    if (error) throw new Error(error.message);
    if (!comparePassword(String(passwordActual ?? ''), fila.password)) {
      throw new ErrorPublico('La contraseña actual no es correcta', 403);
    }

    cambios.password = hashPassword(passwordNueva);
  }

  if (!Object.keys(cambios).length) {
    throw new ErrorPublico('No hay nada para cambiar');
  }

  const { data, error } = await supabase
    .from('usuario')
    .update(cambios)
    .eq('id', usuario.id)
    .select(CAMPOS_PERFIL)
    .single();

  if (error) throw new Error(error.message);

  if (cambiaPassword) {
    // Cambiar la contraseña tiene que echar a cualquier otra sesión abierta,
    // que es medio punto del cambio. Pero la sesión desde la que se pidió el
    // cambio se queda: se le emite un refresh token nuevo enseguida, para no
    // desloguear al usuario por haber hecho lo correcto.
    await revocarSesionesDeUsuario(supabase, usuario.id);
    const { token, expiresAt } = await crearRefreshToken(supabase, usuario.id);
    setRefreshCookie(res, token, expiresAt);
  }

  return res.json({ perfil: data, passwordCambiada: cambiaPassword });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

  try {
    return req.method === 'GET' ? await ver(res, usuario) : await editar(req, res, usuario);
  } catch (err) {
    return responderError(res, err, 400, 'auth/perfil');
  }
}
