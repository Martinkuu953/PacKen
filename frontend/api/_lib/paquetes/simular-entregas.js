import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { ESTADOS, canonizarEstado } from '../../../shared/estados.js';
import { responderError } from '../errores.js';

// POST /api/paquetes/simular-entregas
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();

    // Los candidatos se eligen canonizando en memoria: un .eq('estado', ...)
    // se saltea los paquetes guardados con otra grafía ("EN CAMINO").
    const { data: candidatos, error: errorLectura } = await supabase
      .from('paquete')
      .select('id, estado')
      .eq('idempresa', usuario.id);
    if (errorLectura) throw new Error(errorLectura.message);

    const ids = (candidatos ?? [])
      .filter((p) => canonizarEstado(p.estado) === ESTADOS.EN_CAMINO)
      .map((p) => p.id);

    if (ids.length === 0) {
      return res.status(200).json({ ok: true, actualizados: 0 });
    }

    const { error } = await supabase
      .from('paquete')
      .update({ estado: ESTADOS.ENTREGADO, fechaentrega: new Date().toISOString() })
      .in('id', ids);

    if (error) throw new Error(error.message);

    console.log(`[PacKen] Simulación: ${ids.length} paquete(s) marcados como Entregado`);
    return res.status(200).json({ ok: true, actualizados: ids.length });
  } catch (err) {
    return responderError(res, err, 500, 'simular-entregas');
  }
}
