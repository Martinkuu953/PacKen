import { verificarToken } from '../lib/auth.js';

// Lee el JWT del header Authorization: Bearer <token> y lo deja en req.usuario.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [esquema, token] = header.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token de autenticación' });
  }

  try {
    req.usuario = verificarToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Restringe el acceso a uno o más roles. Usar después de requireAuth.
export function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
}
