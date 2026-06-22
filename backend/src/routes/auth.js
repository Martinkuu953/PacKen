import { Router } from 'express';
import { query } from '../lib/db.js';
import {
  hashearContrasena,
  compararContrasena,
  firmarToken,
} from '../lib/auth.js';
import { requireAuth, requireRol } from '../middleware/auth.js';

const router = Router();

// Da forma al usuario público (sin contraseña) según su rol.
function usuarioPublico(rol, fila) {
  return {
    id: fila.id,
    rol,
    nombre: fila.nombre,
    correoelectronico: fila.correoelectronico ?? null,
    telefono: fila.telefono ?? null,
    idempresa: fila.idempresa ?? null,
    empresa: fila.empresa_nombre ?? null,
  };
}

// Busca un seller por correo, teléfono o nombre de empresa.
async function buscarSeller(identificador) {
  const { rows } = await query(
    `SELECT s.*, e.nombre AS empresa_nombre
       FROM seller s
       LEFT JOIN empresa e ON e.id = s.idempresa
      WHERE lower(s.correoelectronico) = lower($1)
         OR s.telefono = $1
         OR lower(e.nombre) = lower($1)
      LIMIT 1`,
    [identificador],
  );
  return rows[0] ?? null;
}

// Busca un transportista por correo o teléfono.
async function buscarTransportista(identificador) {
  const { rows } = await query(
    `SELECT t.*, e.nombre AS empresa_nombre
       FROM transportista t
       LEFT JOIN empresa e ON e.id = t.idempresa
      WHERE lower(t.correoelectronico) = lower($1)
         OR t.telefono = $1
      LIMIT 1`,
    [identificador],
  );
  return rows[0] ?? null;
}

// ── POST /api/auth/login ──────────────────────────────────────────────────
// Acepta sellers y transportistas. body: { identificador, contrasena }
router.post('/login', async (req, res, next) => {
  try {
    const { identificador, contrasena } = req.body ?? {};
    if (!identificador || !contrasena) {
      return res
        .status(400)
        .json({ error: 'Ingresá tu usuario y contraseña' });
    }

    // Probamos primero como seller, después como transportista.
    const candidatos = [
      { rol: 'seller', fila: await buscarSeller(identificador) },
      { rol: 'transportista', fila: await buscarTransportista(identificador) },
    ];

    for (const { rol, fila } of candidatos) {
      if (!fila) continue;
      const ok = await compararContrasena(contrasena, fila.contrasena);
      if (!ok) continue;

      const usuario = usuarioPublico(rol, fila);
      const token = firmarToken({ id: usuario.id, rol });
      return res.json({ token, usuario });
    }

    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/registro ───────────────────────────────────────────────
// Auto-registro de un SELLER. body: { nombre, empresa, correoelectronico,
// telefono, contrasena, ubicacion? }
router.post('/registro', async (req, res, next) => {
  try {
    const {
      nombre,
      empresa,
      correoelectronico,
      telefono,
      contrasena,
      ubicacion,
    } = req.body ?? {};

    if (!nombre || !correoelectronico || !contrasena) {
      return res.status(400).json({
        error: 'Nombre, correo electrónico y contraseña son obligatorios',
      });
    }

    // ¿Ya existe un seller con ese correo?
    const { rows: existentes } = await query(
      'SELECT id FROM seller WHERE lower(correoelectronico) = lower($1) LIMIT 1',
      [correoelectronico],
    );
    if (existentes.length > 0) {
      return res
        .status(409)
        .json({ error: 'Ya existe una cuenta con ese correo electrónico' });
    }

    const hash = await hashearContrasena(contrasena);

    // Resolver la empresa: buscar por nombre o crearla. La empresa hereda el
    // correo y la contraseña del seller que la registra (columnas NOT NULL).
    let idEmpresa = null;
    if (empresa) {
      const { rows: emp } = await query(
        'SELECT id FROM empresa WHERE lower(nombre) = lower($1) LIMIT 1',
        [empresa],
      );
      if (emp.length > 0) {
        idEmpresa = emp[0].id;
      } else {
        const { rows: nueva } = await query(
          'INSERT INTO empresa (nombre, correoelectronico, contrasena) VALUES ($1, $2, $3) RETURNING id',
          [empresa, correoelectronico, hash],
        );
        idEmpresa = nueva[0].id;
      }
    }
    const { rows } = await query(
      `INSERT INTO seller (idempresa, nombre, correoelectronico, telefono, contrasena, direccion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [idEmpresa, nombre, correoelectronico, telefono ?? null, hash, ubicacion ?? null],
    );

    const fila = { ...rows[0], empresa_nombre: empresa ?? null };
    const usuario = usuarioPublico('seller', fila);
    const token = firmarToken({ id: usuario.id, rol: 'seller' });
    return res.status(201).json({ token, usuario });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/transportistas ─────────────────────────────────────────
// Alta de un TRANSPORTISTA hecha por un SELLER logueado.
// body: { nombre, correoelectronico, telefono, dni, contrasena }
router.post(
  '/transportistas',
  requireAuth,
  requireRol('seller'),
  async (req, res, next) => {
    try {
      const { nombre, correoelectronico, telefono, dni, contrasena } =
        req.body ?? {};

      if (!nombre || !correoelectronico || !contrasena) {
        return res.status(400).json({
          error: 'Nombre, correo electrónico y contraseña son obligatorios',
        });
      }

      const { rows: existentes } = await query(
        'SELECT id FROM transportista WHERE lower(correoelectronico) = lower($1) LIMIT 1',
        [correoelectronico],
      );
      if (existentes.length > 0) {
        return res
          .status(409)
          .json({ error: 'Ya existe un transportista con ese correo' });
      }

      // El transportista hereda la empresa del seller que lo da de alta.
      const { rows: seller } = await query(
        'SELECT idempresa FROM seller WHERE id = $1 LIMIT 1',
        [req.usuario.id],
      );
      const idEmpresa = seller[0]?.idempresa ?? null;

      const hash = await hashearContrasena(contrasena);
      const { rows } = await query(
        `INSERT INTO transportista (idempresa, nombre, correoelectronico, telefono, dni, contrasena)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [idEmpresa, nombre, correoelectronico, telefono ?? null, dni ?? null, hash],
      );

      return res
        .status(201)
        .json({ transportista: usuarioPublico('transportista', rows[0]) });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────
// Devuelve el usuario actual a partir del token.
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { id, rol } = req.usuario;
    const tabla = rol === 'seller' ? 'seller' : 'transportista';
    const { rows } = await query(
      `SELECT u.*, e.nombre AS empresa_nombre
         FROM ${tabla} u
         LEFT JOIN empresa e ON e.id = u.idempresa
        WHERE u.id = $1 LIMIT 1`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({ usuario: usuarioPublico(rol, rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
