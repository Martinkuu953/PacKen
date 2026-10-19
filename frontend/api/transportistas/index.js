import { getSupabase } from '../_lib/ml.js';
import { responderError } from '../_lib/errores.js';
import { revocarSesionesDeUsuario } from '../_lib/refreshTokens.js';
import { cargarResolutorZonas } from '../_lib/zonas.js';
import {
  autenticar,
  requiereRol,
  hashPassword,
  validarPassword,
  validarEmail,
} from '../_lib/auth.js';

// GET /api/transportistas — la flota de la empresa, un transportista por fila
// con sus paquetes agrupados por estado y el monto a pagarle (entregados),
// mismo criterio que /api/sellers pero con la lista de COSTOS
// (usuario.idlista_costo) en vez de la de precios.
function normalizarEstado(estado) {
  return String(estado ?? '').toLowerCase().trim();
}

function resumenVacio() {
  return { totales: 0, enCamino: 0, entregados: 0, cancelados: 0, reprogramados: 0, monto: 0 };
}

function acumular(resumen, estado) {
  const e = normalizarEstado(estado);
  resumen.totales += 1;
  if (e.includes('camino')) resumen.enCamino += 1;
  if (e.includes('entregad')) resumen.entregados += 1;
  if (e.includes('cancel')) resumen.cancelados += 1;
  if (e.includes('reprogram')) resumen.reprogramados += 1;
}

async function listar(res, supabase, idempresa) {
  const [usuarios, paquetes, listas] = await Promise.all([
    supabase
      .from('usuario')
      .select('id, public_id, nombre, dni, created_at, idlista_costo')
      .eq('rol', 'transportista')
      .eq('idempresa', idempresa)
      .order('nombre'),
    supabase
      .from('paquete')
      .select('idtransportista, idarea, idzona, estado')
      .eq('idempresa', idempresa)
      .not('idtransportista', 'is', null),
    supabase.from('lista').select('id').eq('idempresa', idempresa).eq('tipo', 'costo'),
  ]);

  if (usuarios.error) throw new Error(`usuario: ${usuarios.error.message}`);
  if (paquetes.error) throw new Error(`paquete: ${paquetes.error.message}`);
  if (listas.error) throw new Error(`lista: ${listas.error.message}`);

  // El costo de un paquete = tarifa(lista del transportista, zona del paquete).
  const listaIds = (listas.data ?? []).map((l) => l.id);
  let tarifas = [];
  if (listaIds.length) {
    const { data, error } = await supabase
      .from('lista_zona_tarifa')
      .select('idlista, idzona, importe')
      .in('idlista', listaIds);
    if (error) throw new Error(`lista_zona_tarifa: ${error.message}`);
    tarifas = data ?? [];
  }
  const tarifaPorListaZona = new Map(
    tarifas.map((t) => [`${t.idlista}-${t.idzona}`, Number(t.importe)]),
  );
  const listaPorTransportista = new Map((usuarios.data ?? []).map((t) => [t.id, t.idlista_costo]));

  // La zona se lee con la lista de ESE transportista: el mismo barrio puede
  // caer en zonas distintas según la lista.
  const zonaDe = await cargarResolutorZonas(supabase, idempresa, listaIds);

  const resumenPorTransportista = new Map();
  for (const p of paquetes.data ?? []) {
    if (!resumenPorTransportista.has(p.idtransportista)) {
      resumenPorTransportista.set(p.idtransportista, resumenVacio());
    }
    const resumen = resumenPorTransportista.get(p.idtransportista);
    acumular(resumen, p.estado);

    if (normalizarEstado(p.estado).includes('entregad')) {
      const idlista = listaPorTransportista.get(p.idtransportista);
      if (idlista) {
        const idzona = zonaDe(idlista, p.idarea, p.idzona);
        resumen.monto += tarifaPorListaZona.get(`${idlista}-${idzona}`) ?? 0;
      }
    }
  }

  // El cliente solo conoce el UUID opaco. Ni el id interno, ni el email, ni la
  // lista asignada salen de acá.
  const transportistas = (usuarios.data ?? []).map((t) => ({
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

  const { data, error } = await supabase
    .from('usuario')
    .insert({
      nombre: String(nombre).trim(),
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
    return await listar(res, supabase, usuario.id);
  } catch (err) {
    return responderError(res, err, ['POST', 'PATCH'].includes(req.method) ? 400 : 500, '/api/transportistas');
  }
}
