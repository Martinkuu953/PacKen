import { getSupabase } from '../_lib/ml.js';
import { responderError } from '../_lib/errores.js';
import { revocarSesionesDeUsuario } from '../_lib/refreshTokens.js';
import { resumenVacio, resumenPorEntidad } from '../_lib/consultas.js';
import { limpiarNombre, nombreRepetido } from '../_lib/nombres.js';
import {
  autenticar,
  requiereRol,
  hashPassword,
  validarPassword,
  validarEmail,
  validarNombre,
} from '../_lib/auth.js';

// GET /api/transportistas — la flota de la empresa, un transportista por fila
// con sus paquetes agrupados por estado y el monto a pagarle (entregados),
// mismo criterio que /api/sellers pero con la lista de COSTOS
// (usuario.idlista_costo). Se calcula en Postgres con
// resumen_paquetes_por_entidad() (ver migration-escala.sql).
// GET ?soloNombres=1 devuelve solo { id, nombre }, para los selectores.
async function listar(req, res, supabase, idempresa) {
  const { data: usuarios, error } = await supabase
    .from('usuario')
    .select('id, public_id, nombre, dni, created_at')
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa)
    .order('nombre');
  if (error) throw new Error(`usuario: ${error.message}`);

  if (req.query?.soloNombres) {
    return res.json({
      transportistas: (usuarios ?? []).map((t) => ({ id: t.public_id, nombre: t.nombre })),
    });
  }

  const resumenPorTransportista = await resumenPorEntidad(supabase, idempresa, 'transportista');

  // El cliente solo conoce el UUID opaco. Ni el id interno, ni el email, ni la
  // lista asignada salen de acá.
  const transportistas = (usuarios ?? []).map((t) => ({
    id: t.public_id,
    nombre: t.nombre,
    dni: t.dni,
    created_at: t.created_at,
    ...(resumenPorTransportista.get(t.id) ?? resumenVacio()),
  }));

  const montoTotal = transportistas.reduce((sum, t) => sum + t.monto, 0);

  return res.json({ transportistas, montoTotal });
}

// POST /api/transportistas { nombre, email, dni, password }
// Alta de un transportista hecha por la empresa: es la única forma de crear
// una cuenta de transportista, no existe autorregistro. Nace aceptado.
async function crear(req, res, supabase, idempresa) {
  const { nombre, email, dni, password } = req.body ?? {};

  if (!nombre || !email || !password || !dni) {
    return res.status(400).json({ error: 'nombre, email, dni y password son requeridos' });
  }

  const errorEmail = validarEmail(email);
  if (errorEmail) return res.status(400).json({ error: errorEmail });

  const errorPassword = validarPassword(password);
  if (errorPassword) return res.status(400).json({ error: errorPassword });

  if (!/^\d{6,}$/.test(String(dni).trim())) {
    return res.status(400).json({ error: 'El DNI debe ser numérico' });
  }

  const errorNombre = validarNombre(String(nombre));
  if (errorNombre) return res.status(400).json({ error: errorNombre });

  const nom = limpiarNombre(nombre);
  const { data: existentes, error: errExistentes } = await supabase
    .from('usuario')
    .select('id, nombre')
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa);
  if (errExistentes) throw new Error(errExistentes.message);
  if (nombreRepetido(existentes, nom)) {
    return res.status(409).json({ error: `Ya existe un transportista llamado "${nom}". Elegí otro nombre.` });
  }

  const { data, error } = await supabase
    .from('usuario')
    .insert({
      nombre: nom,
      email: String(email).toLowerCase().trim(),
      password: hashPassword(password),
      dni: String(dni).trim(),
      rol: 'transportista',
      idempresa,
      estado_solicitud: 'aceptado',
    })
    .select('public_id, nombre, dni, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El email o DNI ya está registrado' });
    }
    throw new Error(error.message);
  }

  const { public_id, ...resto } = data;
  return res.status(201).json({ transportista: { id: public_id, ...resto } });
}

// PATCH /api/transportistas?transportistaId=<public_id> { password }
// Restablece la contrasena de un transportista de la empresa.
//
// No existe "ver la contrasena": lo guardado es un hash de bcrypt, de una sola
// via. Cuando un transportista se la olvida, lo unico posible es ponerle una
// nueva y pasarsela, que es lo mismo que ya pasa al crearlo.
//
// El filtro por idempresa no es decorativo: sin el, cualquier empresa podria
// pisarle la contrasena a un transportista de otra mandando su public_id.
async function restablecerPassword(req, res, supabase, idempresa) {
  const { transportistaId } = req.query;
  if (!transportistaId) return res.status(400).json({ error: 'transportistaId es requerido' });

  const { password } = req.body ?? {};
  const errorPassword = validarPassword(password);
  if (errorPassword) return res.status(400).json({ error: errorPassword });

  const { data, error } = await supabase
    .from('usuario')
    .update({ password: hashPassword(password) })
    .eq('public_id', transportistaId)
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa)
    .select('id, nombre')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: 'Transportista no encontrado' });

  // Si el transportista tenia la sesion abierta, la contrasena que conoce ya
  // no sirve: dejarlo adentro haria que el cambio recien se note dentro de 30
  // dias, cuando venza el refresh token.
  await revocarSesionesDeUsuario(supabase, data.id);

  return res.json({ ok: true, nombre: data.nombre });
}

// DELETE /api/transportistas?transportistaId=<public_id>
// Solo se puede borrar si no tiene paquetes asignados ni listas de costos con
// tarifas (FK desde paquete/lista_costos): se lo comunicamos al usuario en
// vez de dejar que reviente como error 500.
async function borrar(req, res, supabase, idempresa) {
  const { transportistaId } = req.query;
  if (!transportistaId) return res.status(400).json({ error: 'transportistaId es requerido' });

  const { data, error } = await supabase
    .from('usuario')
    .delete()
    .eq('public_id', transportistaId)
    .eq('rol', 'transportista')
    .eq('idempresa', idempresa)
    .select('public_id')
    .maybeSingle();

  if (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'No se puede eliminar: el transportista tiene paquetes u otros datos asociados.',
      });
    }
    throw new Error(error.message);
  }
  if (!data) return res.status(404).json({ error: 'Transportista no encontrado' });

  return res.json({ ok: true });
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();
    if (req.method === 'POST') return await crear(req, res, supabase, usuario.id);
    if (req.method === 'PATCH') return await restablecerPassword(req, res, supabase, usuario.id);
    if (req.method === 'DELETE') return await borrar(req, res, supabase, usuario.id);
    return await listar(req, res, supabase, usuario.id);
  } catch (err) {
    return responderError(res, err, ['POST', 'PATCH'].includes(req.method) ? 400 : 500, '/api/transportistas');
  }
}
