import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { canonizarEstado, ESTADOS } from '../../../shared/estados.js';
import { responderError } from '../errores.js';

// GET /api/auth/asistente — en qué punto de la puesta en marcha está la
// empresa. Lo usa el asistente guiado del panel para decirle al administrador
// cuál es el próximo paso. Solo devuelve conteos: nada de ids ni nombres.
//
// Vive en el dispatcher de /api/auth para no sumar una Serverless Function
// (límite de 12 del plan Hobby de Vercel).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();
    const idempresa = usuario.id;

    const [sellersQ, transportistasQ, zonasQ, areasQ, listasQ, paquetesQ] = await Promise.all([
      supabase.from('seller').select('id, idlista').eq('idempresa', idempresa),
      supabase
        .from('usuario')
        .select('estado_solicitud, idlista_costo')
        .eq('idempresa', idempresa)
        .eq('rol', 'transportista'),
      supabase.from('zona').select('id', { count: 'exact', head: true }).eq('idempresa', idempresa),
      supabase.from('area_flex').select('idzona').eq('idempresa', idempresa),
      supabase.from('lista').select('tipo').eq('idempresa', idempresa),
      supabase.from('paquete').select('estado, idtransportista').eq('idempresa', idempresa),
    ]);

    for (const q of [sellersQ, transportistasQ, zonasQ, areasQ, listasQ, paquetesQ]) {
      if (q.error) throw new Error(q.error.message);
    }

    const sellers = sellersQ.data ?? [];
    let sellersConectados = 0;
    if (sellers.length) {
      const { data: tokens, error } = await supabase
        .from('meli_token')
        .select('idseller')
        .in('idseller', sellers.map((s) => s.id));
      if (error) throw new Error(error.message);
      sellersConectados = new Set((tokens ?? []).map((t) => t.idseller)).size;
    }

    const transportistas = transportistasQ.data ?? [];
    const aceptados = transportistas.filter((t) => t.estado_solicitud === 'aceptado');
    const areas = areasQ.data ?? [];
    const listas = listasQ.data ?? [];
    const paquetes = paquetesQ.data ?? [];
    const estadoDe = (p) => canonizarEstado(p.estado);

    return res.json({
      sellers: {
        total: sellers.length,
        conectados: sellersConectados,
        sinLista: sellers.filter((s) => !s.idlista).length,
      },
      transportistas: {
        total: transportistas.length,
        aceptados: aceptados.length,
        sinLista: aceptados.filter((t) => !t.idlista_costo).length,
      },
      zonas: { total: zonasQ.count ?? 0 },
      barrios: {
        total: areas.length,
        sinZona: areas.filter((a) => !a.idzona).length,
      },
      listas: {
        precio: listas.filter((l) => l.tipo === 'precio').length,
        costo: listas.filter((l) => l.tipo === 'costo').length,
      },
      paquetes: {
        total: paquetes.length,
        ingresados: paquetes.filter((p) => estadoDe(p) === ESTADOS.INGRESADO).length,
        enCamino: paquetes.filter((p) => estadoDe(p) === ESTADOS.EN_CAMINO).length,
        sinTransportista: paquetes.filter(
          (p) => !p.idtransportista && [ESTADOS.INGRESADO, ESTADOS.EN_CAMINO].includes(estadoDe(p)),
        ).length,
      },
    });
  } catch (err) {
    return responderError(res, err, 500, 'asistente');
  }
}
