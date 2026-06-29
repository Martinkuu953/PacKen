import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../lib/db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

export async function registrar({ nombre, email, password, dni, rol }) {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const { rows } = await query(
    `INSERT INTO usuario (nombre, email, password, dni, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, email, dni, rol, created_at`,
    [nombre, email.toLowerCase().trim(), hash, dni || null, rol],
  );
  const usuario = rows[0];
  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol, email: usuario.email, nombre: usuario.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
  return { usuario, token };
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

  const token = jwt.sign(
    { id: usuario.id, rol: usuario.rol, email: usuario.email, nombre: usuario.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      dni: usuario.dni,
      rol: usuario.rol,
    },
    token,
  };
}
