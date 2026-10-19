import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { ESTADOS } from '../../../shared/estados.js';
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

    // Los paquetes solo se CUENTAN (head: true): con volumen, traerlos para
    // contarlos en JS no escala y además se cortaba en 1000 filas.
    const contarPaquetes = (filtrar = (q) => q) =>
      filtrar(
        supabase.from('paquete').select('id', { count: 'exact', head: true }).eq('idempresa', idempresa),
      );
    const ABIERTOS = [ESTADOS.INGRESADO, ESTADOS.EN_CAMINO];

    const [
      sellersQ, transportistasQ, zonasQ, areasQ, areasSinZonaQ, listasQ,
      totalQ, ingresadosQ, enCaminoQ, sinTransportistaQ,
    ] = await Promise.all([
      supabase.from('seller').select('id, idlista').eq('idempresa', idempresa),
      supabase
        .from('usuario')
        .select('estado_solicitud, idlista_costo')
        .eq('idempresa', idempresa)
        .eq('rol', 'transportista'),
      supabase.from('zona').select('id', { count: 'exact', head: true }).eq('idempresa', idempresa),
      // Los barrios de Flex de AMBA pasan las 1000 filas: también se cuentan.
      supabase.from('area_flex').select('id', { count: 'exact', head: true }).eq('idempresa', idempresa),
      supabase
        .from('area_flex')
        .select('id', { count: 'exact', head: true })
        .eq('idempresa', idempresa)
        .is('idzona', null),
      supabase.from('lista').select('tipo').eq('idempresa', idempresa),
      contarPaquetes(),
      contarPaquetes((q) => q.eq('estado', ESTADOS.INGRESADO)),
      contarPaquetes((q) => q.eq('estado', ESTADOS.EN_CAMINO)),
      contarPaquetes((q) => q.is('idtransportista', null).in('estado', ABIERTOS)),
    ]);

    for (const q of [
      sellersQ, transportistasQ, zonasQ, areasQ, areasSinZonaQ, listasQ,
      totalQ, ingresadosQ, enCaminoQ, sinTransportistaQ,
    ]) {
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
    const listas = listasQ.data ?? [];

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
        total: areasQ.count ?? 0,
        sinZona: areasSinZonaQ.count ?? 0,
      },
      listas: {
        precio: listas.filter((l) => l.tipo === 'precio').length,
        costo: listas.filter((l) => l.tipo === 'costo').length,
      },
      paquetes: {
        total: totalQ.count ?? 0,
        ingresados: ingresadosQ.count ?? 0,
        enCamino: enCaminoQ.count ?? 0,
        sinTransportista: sinTransportistaQ.count ?? 0,
      },
    });
  } catch (err) {
    return responderError(res, err, 500, 'asistente');
  }
}
