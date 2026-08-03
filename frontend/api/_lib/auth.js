import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabase } from './ml.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const SALT_ROUNDS = 10;

// Lo que necesita el servidor para autorizar. Sale de la DB en cada request,
// nunca del token.
const CAMPOS_SESION = 'id, nombre, rol, idempresa, estado_solicitud';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

export function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

// El payload de un JWT va firmado pero NO cifrado: cualquiera puede leerlo con
// atob(). Por eso lo único que viaja es el public_id, un UUID opaco. Ni el id
// interno, ni el email, ni el rol.
export function generateToken(usuario) {
  if (!usuario.public_id) {
    throw new Error('No se puede firmar el token: falta public_id (¿corriste migration-public-id.sql?)');
  }
  return jwt.sign({ sub: usuario.public_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Perfil que viaja en el body de las respuestas: solo lo que la UI renderiza.
// Ni el id ni el email salen del servidor.
export function perfilPublico(usuario) {
  return {
    nombre: usuario.nombre,
    rol: usuario.rol,
    estado_solicitud: usuario.estado_solicitud ?? null,
  };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Resuelve el UUID del token contra la DB y devuelve la sesión con el id
// interno. Al leer siempre de la DB, rol y estado_solicitud están al día: no
// quedan congelados hasta que expire el access token.
export async function autenticar(req, res) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return null;
  }

  let sub;
  try {
    ({ sub } = verifyToken(header.split(' ')[1]));
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return null;
  }

  if (!sub) {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return null;
  }

  const { data, error } = await getSupabase()
    .from('usuario')
    .select(CAMPOS_SESION)
    .eq('public_id', sub)
    .maybeSingle();

  if (error || !data) {
    res.status(401).json({ error: 'Sesión inválida, iniciá sesión nuevamente' });
    return null;
  }

  return data;
}

export function requiereRol(res, usuario, ...roles) {
  if (!roles.includes(usuario.rol)) {
    res.status(403).json({ error: 'No tenés permiso para esta acción' });
    return false;
  }
  return true;
}
