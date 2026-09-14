import { getSupabase, crearClienteML, mapShipment } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { responderError } from '../errores.js';

// Recalcula la zona de los paquetes ya cargados preguntándole el barrio a ML.
//
// Para qué: la zona de un paquete se resuelve UNA vez, al escanearlo, con el
// mapeo barrio→zona que existía en ese momento. Si después se crean zonas
// nuevas o se reasignan barrios, los paquetes viejos siguen apuntando a la zona
// vieja. Esto los vuelve a resolver contra el mapeo actual.
//
// Hay que volver a preguntarle a ML porque el barrio NO se guarda en el
// paquete: al escanear solo queda el idzona resultante.
//
// Dos decisiones de seguridad, porque esto toca plata (la zona define la
// tarifa con la que se liquida):
//
//   1. Simula salvo que se pida aplicar explícitamente. Sin `aplicar: true`
//      devuelve qué cambiaría y no escribe nada.
//   2. Si el barrio no está mapeado a ninguna zona, DEJA EL PAQUETE COMO ESTÁ
//      y lo reporta en `sinMapear`. Mandarlo a General sería peor que no hacer
//      nada: General no puede tener tarifa (es la zona global, con idempresa
//      NULL, y las listas solo siembran tarifas para las zonas de la empresa),
//      así que el paquete pasaría a liquidar en $0 sin avisar.

// Atado al maxDuration de 60s del dispatcher, con el mismo criterio que
// sincronizar-ml: lo que no entra en una corrida entra en la siguiente.
const MAX_POR_CORRIDA = 300;
const CONCURRENCIA = 5;

// Tope de filas de detalle en la respuesta, para no devolver un JSON enorme.
const MAX_DETALLE = 100;

async function enPool(items, limite, tarea) {
  let indice = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (indice < items.length) {
      await tarea(items[indice++]);
    }
  });
  await Promise.all(trabajadores);
}

export async function rezonificarPaquetes(supabase, idEmpresa, { aplicar = false } = {}) {
  const { data: paquetes, error } = await supabase
    .from('paquete')
    .select('id, idenvioml, idseller, idzona')
    .eq('idempresa', idEmpresa)
    .not('idenvioml', 'is', null)
    .not('idseller', 'is', null)
    .order('id')
    .limit(MAX_POR_CORRIDA);
  if (error) throw new Error(error.message);

  const stats = {
    revisados: paquetes?.length ?? 0,
    cambiados: 0,
    sinCambio: 0,
    errores: 0,
    cambios: [],
    sinMapear: [],
  };
  if (!stats.revisados) return stats;

  // Nombres de zona para que el informe se lea, en vez de mostrar ids internos.
  const { data: zonasRows } = await supabase
    .from('zona')
    .select('id, nombre')
    .or(`idempresa.eq.${idEmpresa},id.eq.1`);
  const nombreZona = new Map((zonasRows ?? []).map((z) => [z.id, z.nombre]));

  // Barrios que aparecieron sin zona asignada, agrupados para el informe: lo
  // que hay que ir a mapear en "Establecer zonas".
  const pendientes = new Map();

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
      // Un seller sin token no tumba la corrida: el resto se procesa igual.
      console.error(`[PacKen Rezonificar] Seller ${idseller} sin token utilizable:`, err.message);
      stats.errores += delSeller.length;
      continue;
    }

    await enPool(delSeller, CONCURRENCIA, async (paquete) => {
      try {
        const envio = mapShipment(await pedir(`/shipments/${paquete.idenvioml}`));

        if (!envio.barrioRef) {
          stats.sinCambio += 1;
          return;
        }

        // Registra el barrio si es nuevo (sin zona) y lee a qué zona apunta.
        await supabase
          .from('area_flex')
          .upsert(
            { idempresa: idEmpresa, nombre: envio.barrio || envio.barrioRef, ml_ref: envio.barrioRef },
            { onConflict: 'idempresa,ml_ref', ignoreDuplicates: true },
          );

        const { data: area } = await supabase
          .from('area_flex')
          .select('idzona')
          .eq('idempresa', idEmpresa)
          .eq('ml_ref', envio.barrioRef)
          .maybeSingle();

        if (!area?.idzona) {
          // Barrio sin mapear: no se toca el paquete, solo se reporta.
          const previo = pendientes.get(envio.barrioRef) ?? {
            barrio: envio.barrio || envio.barrioRef,
            ref: envio.barrioRef,
            paquetes: 0,
          };
          previo.paquetes += 1;
          pendientes.set(envio.barrioRef, previo);
          stats.sinCambio += 1;
          return;
        }

        if (area.idzona === paquete.idzona) {
          stats.sinCambio += 1;
          return;
        }

        if (aplicar) {
          const { error: errUpd } = await supabase
            .from('paquete')
            .update({ idzona: area.idzona })
            .eq('id', paquete.id);
          if (errUpd) throw new Error(errUpd.message);
        }

        stats.cambiados += 1;
        if (stats.cambios.length < MAX_DETALLE) {
          stats.cambios.push({
            idenvioml: paquete.idenvioml,
            barrio: envio.barrio ?? null,
            de: nombreZona.get(paquete.idzona) ?? `#${paquete.idzona}`,
            a: nombreZona.get(area.idzona) ?? `#${area.idzona}`,
          });
        }
      } catch (err) {
        stats.errores += 1;
        console.error(`[PacKen Rezonificar] Error en shipment ${paquete.idenvioml}:`, err.message);
      }
    });
  }

  stats.sinMapear = [...pendientes.values()].sort((a, b) => b.paquetes - a.paquetes);
  return stats;
}

// POST /api/paquetes/rezonificar   { aplicar?: boolean }
// Sin `aplicar: true` solo simula y devuelve qué cambiaría.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const aplicar = req.body?.aplicar === true;
    const stats = await rezonificarPaquetes(getSupabase(), usuario.id, { aplicar });

    console.log(
      `[PacKen Rezonificar] empresa ${usuario.id} (${aplicar ? 'APLICANDO' : 'simulación'}): ` +
        `${stats.revisados} revisados, ${stats.cambiados} ${aplicar ? 'cambiados' : 'a cambiar'}, ` +
        `${stats.sinMapear.length} barrios sin mapear, ${stats.errores} con error`,
    );

    return res.status(200).json({ ok: true, aplicado: aplicar, ...stats });
  } catch (err) {
    return responderError(res, err, 500, 'rezonificar');
  }
}
