import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

export function firmarAccessToken(usuario) {
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

export function verificarAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
