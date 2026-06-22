import {
  getSupabase,
  resolverSellerInterno,
  obtenerShipment,
  ESTADO_POR_TIPO,
} from '../_lib/ml.js';

// Estados reales de ML que tienen prioridad sobre la acción de escaneo del courier.
// Ej: si ML ya lo marca como entregado/cancelado, no lo pisamos con "Ingresado".
const ESTADOS_ML_PRIORITARIOS = ['Entregado', 'Cancelado', 'Reprogramado'];

// POST /api/paquetes/escanear  { shipmentId, sellerId, tipo }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shipmentId, sellerId, tipo } = req.body ?? {};

    if (!shipmentId || !sellerId || !tipo) {
      return res.status(400).json({ error: 'shipmentId, sellerId y tipo son requeridos' });
    }
    if (!ESTADO_POR_TIPO[tipo]) {
      return res.status(400).json({ error: 'Tipo inválido: debe ser "colecta" o "reparto"' });
    }

    const supabase = getSupabase();
    const idSellerInterno = await resolverSellerInterno(supabase, sellerId);

    console.log(`[PacKen] Escaneo ${tipo} → shipment ${shipmentId}, seller ${sellerId} (interno ${idSellerInterno})`);

    // Trae el envío de ML (incluye estado real: status + substatus)
    const envio = await obtenerShipment(supabase, idSellerInterno, shipmentId);

    // El estado real de ML manda si es terminal; si no, usamos el de la acción de escaneo.
    const estado = ESTADOS_ML_PRIORITARIOS.includes(envio.estado)
      ? envio.estado
      : ESTADO_POR_TIPO[tipo];

    console.log(
      `[PacKen] Estado ML="${envio.estadoMl}" (sub="${envio.subestadoMl}") → estado interno="${estado}"`
    );

    const paqueteData = {
      comprador: envio.comprador,
      direccion: envio.direccion,
      estado,
      codigopostal: envio.codigoPostal,
      fechaentrega: envio.fechaEntrega,
    };

    const { data: existente } = await supabase
      .from('paquete')
      .select('id')
      .eq('idenvioml', envio.idEnvioMl)
      .limit(1)
      .maybeSingle();

    let paquete;
    if (existente) {
      const { data, error: upErr } = await supabase
        .from('paquete')
        .update(paqueteData)
        .eq('id', existente.id)
        .select()
        .single();
      if (upErr) throw new Error(upErr.message);
      paquete = data;
      console.log(`[PacKen] Paquete actualizado (id=${paquete.id})`);
    } else {
      const { data, error: insErr } = await supabase
        .from('paquete')
        .insert({
          idenvioml: envio.idEnvioMl,
          idseller: idSellerInterno,
          idzona: 1,
          ...paqueteData,
        })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      paquete = data;
      console.log(`[PacKen] Paquete insertado (id=${paquete.id})`);
    }

    // Devolvemos el paquete guardado + todos los datos de ML (estado real, tracking, etc.)
    return res.status(200).json({ ok: true, paquete, envio });
  } catch (err) {
    console.error('[PacKen] Error en escanear:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
