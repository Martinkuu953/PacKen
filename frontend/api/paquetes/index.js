import { getSupabase } from '../_lib/ml.js';
import { autenticar } from '../_lib/auth.js';
import { canonizarEstado } from '../../shared/estados.js';

// El cliente solo conoce UUIDs opacos (public_id). Los filtros llegan con ese
// UUID y hay que traducirlo al id interno antes de consultar paquete.
async function resolverId(supabase, tabla, publicId, filtroEmpresa) {
  let query = supabase.from(tabla).select('id').eq('public_id', publicId);
  if (filtroEmpresa != null) query = query.eq('idempresa', filtroEmpresa);
  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

// GET /api/paquetes?estado=&sellerId=&transportistaId=&desde=&hasta=
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

  try {
    const supabase = getSupabase();
    const { estado, sellerId, transportistaId, desde, hasta } = req.query ?? {};

    let query = supabase.from('paquete').select('*').order('fechaingreso', { ascending: false });

    if (usuario.rol === 'transportista') {
      query = query.eq('idtransportista', usuario.id);
    } else if (usuario.rol === 'empresa') {
      // Aislamiento multi-tenant: una empresa solo ve sus propios paquetes.
      query = query.eq('idempresa', usuario.id);

      // Solo la empresa puede filtrar por transportista: para un transportista
      // el filtro por sí mismo ya está aplicado arriba.
      if (transportistaId) {
        const id = await resolverId(supabase, 'usuario', transportistaId, usuario.id);
        if (!id) return res.status(404).json({ error: 'Transportista no encontrado' });
        query = query.eq('idtransportista', id);
      }
    }

    if (sellerId) {
      const idempresa = usuario.rol === 'empresa' ? usuario.id : null;
      const id = await resolverId(supabase, 'seller', sellerId, idempresa);
      if (!id) return res.status(404).json({ error: 'Seller no encontrado' });
      query = query.eq('idseller', id);
    }

    let estadoCanonico = null;
    if (estado) {
      estadoCanonico = canonizarEstado(estado);
      if (!estadoCanonico) {
        return res.status(400).json({ error: `Estado inválido: "${estado}"` });
      }
    }

    // desde/hasta llegan como YYYY-MM-DD. El hasta se extiende al final del día
    // para que el rango sea inclusivo y no deje afuera lo cargado esa fecha.
    if (desde) query = query.gte('fechaingreso', `${desde}T00:00:00.000Z`);
    if (hasta) query = query.lte('fechaingreso', `${hasta}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // El estado se filtra en memoria, no con un .eq() en SQL: en la base
    // conviven grafías distintas del mismo estado ("EN CAMINO", "en_camino")
    // y una comparación exacta las dejaba afuera del listado.
    const paquetes = estadoCanonico
      ? (data ?? []).filter((p) => canonizarEstado(p.estado) === estadoCanonico)
      : (data ?? []);
    const unicos = (campo) => [...new Set(paquetes.map((p) => p[campo]).filter(Boolean))];

    // zona/seller/transportista se resuelven aparte: esas columnas no tienen FK
    // declarada en Supabase, así que un select embebido fallaría.
    const [zonas, sellers, transportistas] = await Promise.all([
      buscarPor(supabase, 'zona', 'id, nombre', unicos('idzona')),
      buscarPor(supabase, 'seller', 'id, public_id, nombre', unicos('idseller')),
      buscarPor(supabase, 'usuario', 'id, public_id, nombre', unicos('idtransportista')),
    ]);

    return res.json({
      // Allowlist explícita: los ids internos (idempresa, idseller,
      // idtransportista, idzona) no salen del servidor, igual que en el resto
      // de los endpoints. Afuera solo viajan nombres y public_id.
      paquetes: paquetes.map((p) => ({
        id: p.id,
        idenvioml: p.idenvioml,
        comprador: p.comprador,
        direccion: p.direccion,
        codigopostal: p.codigopostal,
        fechaingreso: p.fechaingreso,
        fechaentrega: p.fechaentrega,
        // El estado se canoniza al leer: los paquetes migrados desde otra base
        // traen grafías distintas ("EN CAMINO", "en_camino") que la UI
        // clasificaba como desconocidas y dejaba fuera de los listados.
        estado: canonizarEstado(p.estado) ?? p.estado,
        zona: zonas.get(p.idzona)?.nombre ?? null,
        seller: sellers.get(p.idseller)?.nombre ?? null,
        sellerId: sellers.get(p.idseller)?.public_id ?? null,
        transportista: transportistas.get(p.idtransportista)?.nombre ?? null,
        transportistaId: transportistas.get(p.idtransportista)?.public_id ?? null,
      })),
      origen: 'supabase',
    });
  } catch (err) {
    console.error('[PacKen] Error en listar paquetes:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function buscarPor(supabase, tabla, campos, ids) {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from(tabla).select(campos).in('id', ids);
  return new Map((data ?? []).map((fila) => [fila.id, fila]));
}
