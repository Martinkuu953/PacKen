import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { firmarAccessToken } from '../lib/jwt.js';

const SALT_ROUNDS = 10;

// Uso interno: el id para los refresh tokens, el public_id para firmar el JWT.
// Nunca se serializa tal cual en una respuesta.
function datosSesion(u) {
  return {
    id: u.id,
    public_id: u.public_id,
    nombre: u.nombre,
    rol: u.rol,
    idempresa: u.idempresa ?? null,
    estado_solicitud: u.estado_solicitud ?? null,
  };
}

// Perfil que viaja en el body de las respuestas: solo lo que la UI renderiza.
// Ni el id ni el email salen del servidor.
export function perfilPublico(u) {
  return {
    nombre: u.nombre,
    rol: u.rol,
    estado_solicitud: u.estado_solicitud ?? null,
  };
}

export async function registrar({ nombre, email, password, dni, rol, idempresa }) {
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const estadoSolicitud = rol === 'transportista' ? 'pendiente' : null;

  // El cliente manda el public_id de la empresa (UUID opaco), no su id
  // interno. Lo resolvemos acá y de paso validamos que exista de verdad.
  let idEmpresaInterno = null;
  if (rol === 'transportista') {
    const { rows: empresas } = await query(
      "SELECT id FROM usuario WHERE public_id = $1 AND rol = 'empresa'",
      [idempresa],
    );
    if (!empresas[0]) throw new Error('La empresa seleccionada no existe');
    idEmpresaInterno = empresas[0].id;
  }

  const { rows } = await query(
    `INSERT INTO usuario (nombre, email, password, dni, rol, idempresa, estado_solicitud)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, public_id, nombre, rol, idempresa, estado_solicitud`,
    [nombre, email.toLowerCase().trim(), hash, dni || null, rol, idEmpresaInterno, estadoSolicitud],
  );
  const usuario = datosSesion(rows[0]);
  const token = firmarAccessToken(usuario);
  return { usuario, token };
}

export async function login(identificador, password) {
  const esDNI = /^\d+$/.test(identificador);
  const { rows } = esDNI
    ? await query('SELECT * FROM usuario WHERE dni = $1', [identificador])
    : await query('SELECT * FROM usuario WHERE email = $1', [identificador.toLowerCase().trim()]);

  if (!rows[0]) throw new Error('Credenciales inválidas');

  if (!bcrypt.compareSync(password, rows[0].password)) {
    throw new Error('Credenciales inválidas');
  }

  const usuario = datosSesion(rows[0]);
  const token = firmarAccessToken(usuario);
  return { usuario, token };
}

export async function obtenerUsuario(id) {
  const { rows } = await query(
    'SELECT id, public_id, nombre, rol, idempresa, estado_solicitud FROM usuario WHERE id = $1',
    [id],
  );
  if (!rows[0]) throw new Error('Usuario no encontrado');
  return datosSesion(rows[0]);
}
