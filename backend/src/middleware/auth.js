import { verificarAccessToken } from '../lib/jwt.js';
import { query } from '../lib/db.js';

// Resuelve el UUID opaco del token contra la DB y deja en req.usuario el id
// interno + el rol. Al leer siempre de la DB, rol y estado_solicitud están al
// día: no quedan congelados hasta que expire el access token.
export async function autenticar(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  let sub;
  try {
    ({ sub } = verificarAccessToken(header.split(' ')[1]));
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  if (!sub) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const { rows } = await query(
      'SELECT id, nombre, rol, idempresa, estado_solicitud FROM usuario WHERE public_id = $1',
      [sub],
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'Sesión inválida, iniciá sesión nuevamente' });
    }
    req.usuario = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export function requiereRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
}
