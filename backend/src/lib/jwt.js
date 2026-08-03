import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

// El payload de un JWT va firmado pero NO cifrado: cualquiera puede leerlo con
// atob(). Por eso lo único que viaja es el public_id, un UUID opaco. Ni el id
// interno, ni el email, ni el rol.
export function firmarAccessToken(usuario) {
  if (!usuario.public_id) {
    throw new Error('No se puede firmar el token: falta public_id (¿corriste migration-public-id.sql?)');
  }
  return jwt.sign({ sub: usuario.public_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verificarAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
