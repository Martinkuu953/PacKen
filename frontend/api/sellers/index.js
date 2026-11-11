import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';
import { responderError } from '../_lib/errores.js';
import { resumenVacio, resumenPorEntidad } from '../_lib/consultas.js';
import { limpiarNombre, nombreRepetido } from '../_lib/nombres.js';

// GET /api/sellers — un seller por fila con sus paquetes agrupados por
// estado y el monto facturado (entregados), calculado en el momento por
// resumen_paquetes_por_entidad() a partir de paquete + la lista de precios
// asignada al seller. GET ?soloNombres=1 devuelve solo { id, nombre }.
//
// Todo filtrado por la empresa del token, mismo criterio que /api/precios.

// POST /api/sellers { nombre, listaId }
// Alta de un seller: es el único lugar donde se crean (las cuentas las crea la
// empresa, no se autorregistran). listaId es el public_id de una lista de
// precios y queda asignado en el alta para no tener que hacerlo en un segundo
// paso. Nace sin conectar: la cuenta de ML y los tokens los suma después la
// conexión (ver conectarSeller en _lib/ml.js), que completa esta misma fila.
// Todavía acepta `idmercadolibre` por compatibilidad, pero el formulario ya no
// lo manda: un número tipeado a mano no está verificado.
async function crear(req, res, supabase, idempresa) {
  const { nombre, idmercadolibre, listaId } = req.body ?? {};

  const nom = limpiarNombre(nombre);
  if (!nom) return res.status(400).json({ error: 'El nombre es requerido' });

  const { data: existentes, error: errExistentes } = await supabase
    .from('seller')
    .select('id, nombre')
    .eq('idempresa', idempresa);
  if (errExistentes) throw new Error(errExistentes.message);
  if (nombreRepetido(existentes, nom)) {
    return res.status(409).json({ error: `Ya existe un seller llamado "${nom}". Elegí otro nombre.` });
  }

  let idlista = null;
  if (listaId) {
    const { data: lista } = await supabase
      .from('lista')
      .select('id')
      .eq('public_id', listaId)
      .eq('idempresa', idempresa)
      .eq('tipo', 'precio')
      .maybeSingle();
    if (!lista) return res.status(404).json({ error: 'Lista de precios no encontrada' });
    idlista = lista.id;
  }

  const { data, error } = await supabase
    .from('seller')
    .insert({
      nombre: nom,
      idmercadolibre: idmercadolibre ? String(idmercadolibre).trim() : null,
      idempresa,
      idlista,
    })
    .select('public_id, nombre')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un seller con ese ID de Mercado Libre' });
    }
    throw new Error(error.message);
  }

  // `conectado: false` porque nace sin tokens: la pantalla abre directo el panel
  // para conectarlo con Mercado Libre.
  return res.status(201).json({ seller: { id: data.public_id, nombre: data.nombre, conectado: false } });
}

// DELETE /api/sellers?sellerId=<public_id>
// Solo se puede borrar si no tiene paquetes ni la cuenta de Mercado Libre
// conectada (FK desde paquete/meli_token): se lo comunicamos al usuario en
// vez de dejar que reviente como error 500.
async function borrar(req, res, supabase, idempresa) {
  const { sellerId } = req.query;
  if (!sellerId) return res.status(400).json({ error: 'sellerId es requerido' });

  const { data, error } = await supabase
    .from('seller')
    .delete()
    .eq('public_id', sellerId)
    .eq('idempresa', idempresa)
    .select('public_id')
    .maybeSingle();

  if (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'No se puede eliminar: el seller tiene paquetes o una cuenta de Mercado Libre conectada.',
      });
    }
    throw new Error(error.message);
  }
  if (!data) return res.status(404).json({ error: 'Seller no encontrado' });

  return res.json({ ok: true });
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    if (req.method === 'POST') {
      return await crear(req, res, getSupabase(), usuario.id);
    }
    if (req.method === 'DELETE') {
      return await borrar(req, res, getSupabase(), usuario.id);
    }

    const supabase = getSupabase();
    const idempresa = usuario.id;

    const { data: sellers, error: errSellers } = await supabase
      .from('seller')
      .select('id, public_id, nombre')
      .eq('idempresa', idempresa)
      .order('nombre');
    if (errSellers) throw new Error(`seller: ${errSellers.message}`);

    // Para los selectores (catálogos): solo nombres, sin contar paquetes.
    if (req.query?.soloNombres) {
      return res.json({ sellers: (sellers ?? []).map((s) => ({ id: s.public_id, nombre: s.nombre })) });
    }

    // Los conteos y el monto se calculan en Postgres (ver
    // migration-escala.sql): traer los paquetes acá no escala y además se
    // cortaba en 1000 filas.
    const resumenPorSeller = await resumenPorEntidad(supabase, idempresa, 'seller');

    // Conectado = tiene tokens de ML, que es lo que hace falta para leer sus
    // envíos. Un seller recién creado en "Nuevo seller" arranca sin, y hasta
    // que se conecte el escaneo de sus paquetes falla.
    const ids = (sellers ?? []).map((s) => s.id);
    const { data: tokens, error: errTokens } = ids.length
      ? await supabase.from('meli_token').select('idseller').in('idseller', ids)
      : { data: [], error: null };
    if (errTokens) throw new Error(`meli_token: ${errTokens.message}`);
    const conectados = new Set((tokens ?? []).map((t) => t.idseller));

    const listado = (sellers ?? []).map((s) => {
      const resumen = resumenPorSeller.get(s.id) ?? resumenVacio();
      return { id: s.public_id, nombre: s.nombre, conectado: conectados.has(s.id), ...resumen };
    });

    const montoTotal = listado.reduce((sum, s) => sum + s.monto, 0);

    return res.json({ sellers: listado, montoTotal });
  } catch (err) {
    return responderError(res, err, req.method === 'POST' ? 400 : 500, '/api/sellers');
  }
}
