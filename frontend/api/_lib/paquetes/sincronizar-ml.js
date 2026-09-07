import { timingSafeEqual } from 'node:crypto';
import { getSupabase, crearClienteML, decidirEstadoDesdeML } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { ESTADOS } from '../../../shared/estados.js';
import { responderError } from '../errores.js';

// Sincronización periódica del estado de los paquetes contra la API de ML.
//
// El webhook (/api/webhooks/mercadolibre) es la vía rápida: ML avisa y en
// segundos el paquete queda actualizado. Pero es una entrega "de un solo tiro":
// si la notificación se pierde, si el token estaba vencido, o si Supabase falló
// justo en ese momento, ese cambio no vuelve nunca. Este endpoint es la red:
// recorre los paquetes que todavía pueden cambiar y les pregunta a ML el estado
// real. Los dos comparten la misma política (decidirEstadoDesdeML), así que no
// pueden discrepar.

// Tope por corrida. Está atado al maxDuration de la función (60s): 200
// shipments con CONCURRENCIA=5 son ~40 rondas, muy holgado. Lo que no entra en
// una corrida entra en la siguiente, porque el orden es por ml_sincronizado_en
// ascendente (round-robin natural).
const MAX_POR_CORRIDA = 200;

// Conservador a propósito: la API de ML tira 429 y el token es por seller.
const CONCURRENCIA = 5;

// Un paquete ingresado hace más de un mes que sigue sin cerrarse ya no se
// resuelve solo; dejarlo en la cola solo gasta llamadas a ML todos los días.
const DIAS_VENTANA = 30;

// Estados de los que ML ya no nos va a mover: no tiene sentido consultarlos.
const TERMINALES_SQL = '("Entregado","Cancelado")';

// Corre `tarea` sobre `items` con un pool de tamaño fijo.
async function enPool(items, limite, tarea) {
  let indice = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (indice < items.length) {
      await tarea(items[indice++]);
    }
  });
  await Promise.all(trabajadores);
}

// Sincroniza un paquete contra ML. `pedir` es el cliente ya autenticado del
// seller dueño del paquete.
async function sincronizarUno(supabase, pedir, paquete, stats) {
  const shipment = await pedir(`/shipments/${paquete.idenvioml}`);
  const nuevoEstado = decidirEstadoDesdeML(paquete.estado, shipment.status);

  // El estado crudo de ML se guarda siempre, cambie o no el nuestro: es lo
  // único que permite después entender por qué un paquete quedó donde quedó.
  const cambios = {
    estadoml: shipment.status ?? null,
    subestadoml: shipment.substatus ?? null,
    ml_sincronizado_en: new Date().toISOString(),
  };

  if (nuevoEstado) {
    cambios.estado = nuevoEstado;
    if (nuevoEstado === ESTADOS.ENTREGADO) {
      cambios.fechaentrega = shipment.status_history?.date_delivered || new Date().toISOString();
    }
  }

  const { error } = await supabase.from('paquete').update(cambios).eq('id', paquete.id);
  if (error) throw new Error(error.message);

  if (nuevoEstado) {
    stats.actualizados += 1;
    stats.cambios.push({
      idenvioml: paquete.idenvioml,
      de: paquete.estado,
      a: nuevoEstado,
      statusMl: shipment.status,
    });
    console.log(
      `[PacKen Sync] ${paquete.idenvioml}: "${paquete.estado}" -> "${nuevoEstado}" (ML: ${shipment.status}/${shipment.substatus ?? '-'})`,
    );
  }
}

// Marca el paquete como visitado aunque haya fallado. Sin esto un paquete roto
// (shipment borrado en ML, seller sin permisos) queda siempre primero en el
// orden por ml_sincronizado_en y se come la cuota de todas las corridas,
// dejando al resto sin sincronizar nunca.
async function marcarIntento(supabase, id) {
  await supabase
    .from('paquete')
    .update({ ml_sincronizado_en: new Date().toISOString() })
    .eq('id', id);
}

// Sincroniza los paquetes abiertos. `idEmpresa` null = todas (modo cron).
export async function sincronizarPaquetes(supabase, idEmpresa = null) {
  const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('paquete')
    .select('id, idenvioml, idseller, estado')
    .not('idenvioml', 'is', null)
    .not('idseller', 'is', null)
    // Filtrar los terminales en SQL es seguro incluso con las grafías viejas
    // ("ENTREGADO"): lo peor que pasa es que entre un paquete de más, y
    // decidirEstadoDesdeML lo canoniza y lo descarta igual.
    .not('estado', 'in', TERMINALES_SQL)
    .gte('fechaingreso', desde)
    .order('ml_sincronizado_en', { ascending: true, nullsFirst: true })
    .limit(MAX_POR_CORRIDA);

  if (idEmpresa != null) query = query.eq('idempresa', idEmpresa);

  const { data: paquetes, error } = await query;
  if (error) throw new Error(error.message);

  const stats = { revisados: paquetes?.length ?? 0, actualizados: 0, errores: 0, cambios: [] };
  if (!stats.revisados) return stats;

  // Agrupados por seller para resolver el token de ML una sola vez por cuenta
  // en vez de una vez por paquete.
  const porSeller = new Map();
  for (const paquete of paquetes) {
    if (!porSeller.has(paquete.idseller)) porSeller.set(paquete.idseller, []);
    porSeller.get(paquete.idseller).push(paquete);
  }

  for (const [idseller, delSeller] of porSeller) {
    let pedir;
    try {
      pedir = await crearClienteML(supabase, idseller);
    } catch (err) {
      // Un seller sin token válido no puede tumbar la corrida entera: el resto
      // de las cuentas se sincroniza igual.
      console.error(`[PacKen Sync] Seller ${idseller} sin token utilizable:`, err.message);
      stats.errores += delSeller.length;
      await Promise.all(delSeller.map((p) => marcarIntento(supabase, p.id)));
      continue;
    }

    await enPool(delSeller, CONCURRENCIA, async (paquete) => {
      try {
        await sincronizarUno(supabase, pedir, paquete, stats);
      } catch (err) {
        stats.errores += 1;
        console.error(`[PacKen Sync] Error en shipment ${paquete.idenvioml}:`, err.message);
        await marcarIntento(supabase, paquete.id);
      }
    });
  }

  return stats;
}

// El cron no tiene sesión de usuario, así que se autentica con un secreto
// compartido. La comparación es de tiempo constante por costumbre, no porque
// un timing attack sobre HTTP sea práctico.
function esLlamadaDeCron(req) {
  const esperado = process.env.CRON_SECRET;
  const recibido = req.headers['x-cron-secret'];
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(esperado);
  const b = Buffer.from(recibido);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/paquetes/sincronizar
// Dos formas de llamarlo:
//   - cron (header x-cron-secret): sincroniza los paquetes de TODAS las empresas
//   - empresa autenticada (Bearer): sincroniza solo los suyos, a demanda
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let idEmpresa = null;
  if (!esLlamadaDeCron(req)) {
    // Sin secreto válido se exige sesión: si CRON_SECRET no está configurado,
    // el endpoint queda cerrado, no abierto.
    const usuario = await autenticar(req, res);
    if (!usuario) return;
    if (!requiereRol(res, usuario, 'empresa')) return;
    idEmpresa = usuario.id;
  }

  try {
    const stats = await sincronizarPaquetes(getSupabase(), idEmpresa);
    console.log(
      `[PacKen Sync] ${idEmpresa == null ? 'cron' : `empresa ${idEmpresa}`}: ` +
        `${stats.revisados} revisados, ${stats.actualizados} actualizados, ${stats.errores} con error`,
    );
    return res.status(200).json({ ok: true, ...stats });
  } catch (err) {
    return responderError(res, err, 500, 'sincronizar-ml');
  }
}
