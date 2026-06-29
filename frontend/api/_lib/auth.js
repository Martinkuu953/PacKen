import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

export function comparePassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function generateToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      rol: usuario.rol,
      email: usuario.email,
      nombre: usuario.nombre,
      estado_solicitud: usuario.estado_solicitud ?? null,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function autenticar(req, res) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return null;
  }
  try {
    return verifyToken(header.split(' ')[1]);
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return null;
  }
}

export function requiereRol(res, usuario, ...roles) {
  if (!roles.includes(usuario.rol)) {
    res.status(403).json({ error: 'No tenés permiso para esta acción' });
    return false;
  }
  return true;
}
