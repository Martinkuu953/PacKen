import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

function buildToken(usuario) {
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

function safeUser(u) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    dni: u.dni ?? null,
    rol: u.rol,
    idempresa: u.idempresa ?? null,
    estado_solicitud: u.estado_solicitud ?? null,
  };
}

export async function registrar({ nombre, email, password, dni, rol, idempresa }) {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const estadoSolicitud = rol === 'transportista' ? 'pendiente' : null;

  const { rows } = await query(
    `INSERT INTO usuario (nombre, email, password, dni, rol, idempresa, estado_solicitud)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nombre, email, dni, rol, idempresa, estado_solicitud, created_at`,
    [nombre, email.toLowerCase().trim(), hash, dni || null, rol, idempresa || null, estadoSolicitud],
  );
  const usuario = rows[0];
  const token = buildToken(usuario);
  return { usuario: safeUser(usuario), token };
}

export async function login(identificador, password) {
  const esDNI = /^\d+$/.test(identificador);
  const { rows } = esDNI
    ? await query('SELECT * FROM usuario WHERE dni = $1', [identificador])
    : await query('SELECT * FROM usuario WHERE email = $1', [identificador.toLowerCase().trim()]);

  if (!rows[0]) throw new Error('Credenciales inválidas');

  const usuario = rows[0];
  if (!bcrypt.compareSync(password, usuario.password)) {
    throw new Error('Credenciales inválidas');
  }

  const token = buildToken(usuario);
  return { usuario: safeUser(usuario), token };
}

export async function obtenerUsuario(id) {
  const { rows } = await query(
    'SELECT id, nombre, email, dni, rol, idempresa, estado_solicitud FROM usuario WHERE id = $1',
    [id],
  );
  if (!rows[0]) throw new Error('Usuario no encontrado');
  return safeUser(rows[0]);
}
