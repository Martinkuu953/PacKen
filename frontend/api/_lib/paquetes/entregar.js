import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { ESTADOS, canonizarEstado } from '../../../shared/estados.js';
import { responderError } from '../errores.js';
import { esUuid } from './comun.js';

// Tope por pedido: una entrega masiva más grande que esto es casi seguro un
// error de selección, y así la respuesta sigue siendo rápida.
const MAX_POR_PEDIDO = 200;

// POST /api/paquetes/entregar  { ids: [public_id, ...] }
//
// Reemplaza a la vieja "simular-entregas" (B-01), que marcaba como Entregado
// TODO lo que estuviera En camino sin que nadie eligiera nada. Esta entrega
// solo los paquetes que la empresa seleccionó, con las mismas reglas que la
// entrega de a uno: tienen que ser de la empresa y estar En camino. Cada
// cambio queda en el historial con el usuario y origen 'entrega_masiva'.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Elegí al menos un paquete' });
    }
    if (ids.length > MAX_POR_PEDIDO) {
      return res.status(400).json({ error: `Máximo ${MAX_POR_PEDIDO} paquetes por vez` });
    }
    if (!ids.every(esUuid)) {
      return res.status(400).json({ error: 'Hay ids de paquete inválidos' });
    }

    const supabase = getSupabase();
    const { data: paquetes, error: errLectura } = await supabase
      .from('paquete')
      .select('id, estado')
      .eq('idempresa', usuario.id)
      .in('public_id', ids);
    if (errLectura) throw new Error(errLectura.message);

    const entregables = (paquetes ?? [])
      .filter((p) => canonizarEstado(p.estado) === ESTADOS.EN_CAMINO)
      .map((p) => p.id);

    if (entregables.length > 0) {
      const { error } = await supabase
        .from('paquete')
        .update({
          estado: ESTADOS.ENTREGADO,
          fechaentrega: new Date().toISOString(),
          ultimo_cambio_por: usuario.id,
          ultimo_cambio_origen: 'entrega_masiva',
        })
        .in('id', entregables);
      if (error) throw new Error(error.message);
    }

    // Omitidos = pedidos que no son de la empresa, no existen o no estaban En
    // camino. No se distingue cuál es cuál para no confirmar paquetes ajenos.
    const omitidos = ids.length - entregables.length;
    console.log(`[PacKen] Entrega masiva empresa ${usuario.id}: ${entregables.length} entregados, ${omitidos} omitidos`);
    return res.status(200).json({ ok: true, entregados: entregables.length, omitidos });
  } catch (err) {
    return responderError(res, err, 500, 'entregar');
  }
}
