import {
  getSupabase,
  resolverSellerInterno,
  obtenerShipment,
  ESTADO_POR_TIPO,
} from '../ml.js';
import { autenticar } from '../auth.js';

// Registra el barrio del envío en area_flex (si es nuevo, sin zona) y devuelve
// la zona que la empresa le mapeó. Si no hay empresa, ni barrio, ni asignación,
// cae en la zona General (id=1), que es el fallback histórico.
async function resolverZonaYRegistrarArea(supabase, idEmpresa, envio) {
  const ref = envio.barrioRef;
  if (idEmpresa == null || !ref) return 1;

  // ignoreDuplicates: si el barrio ya existe no lo pisamos (preserva su zona).
  await supabase
    .from('area_flex')
    .upsert(
      { idempresa: idEmpresa, nombre: envio.barrio || ref, ml_ref: ref },
      { onConflict: 'idempresa,ml_ref', ignoreDuplicates: true },
    );

  const { data } = await supabase
    .from('area_flex')
    .select('idzona')
    .eq('idempresa', idEmpresa)
    .eq('ml_ref', ref)
    .maybeSingle();

  return data?.idzona ?? 1;
}

// POST /api/paquetes/escanear  { shipmentId, sellerId, tipo }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

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

    const envio = await obtenerShipment(supabase, idSellerInterno, shipmentId);

    const { data: existente } = await supabase
      .from('paquete')
      .select('id, estado, idempresa')
      .eq('idenvioml', envio.idEnvioMl)
      .limit(1)
      .maybeSingle();

    // Colecta: siempre "Ingresado". Si ya existe y se re-escanea en colecta, no cambia.
    // Reparto: pasa a "En camino" solo si el paquete ya fue ingresado.
    // "Entregado" solo llega por webhook de ML.
    let estado;
    if (tipo === 'colecta') {
      estado = 'Ingresado';
    } else {
      if (existente && existente.estado === 'Entregado') {
        estado = 'Entregado';
      } else {
        estado = 'En camino';
      }
    }

    console.log(
      `[PacKen] Estado ML="${envio.estadoMl}" (sub="${envio.subestadoMl}") → estado interno="${estado}"`
    );

    const idTransportista = usuario.rol === 'transportista' ? usuario.id : null;
    // Empresa dueña del paquete: la empresa misma si escanea directo, o la
    // empresa del transportista que escanea. Necesario para aislar por empresa.
    const idEmpresa = usuario.rol === 'empresa' ? usuario.id : (usuario.idempresa ?? null);

    // Zona por el barrio/municipio del envío (mapeo barrio→zona de la empresa).
    // Para un paquete ya existente usamos su empresa; si no, la del escaneo.
    const idEmpresaPaquete = existente?.idempresa ?? idEmpresa;
    const idzonaResuelta = await resolverZonaYRegistrarArea(supabase, idEmpresaPaquete, envio);

    const paqueteData = {
      comprador: envio.comprador,
      direccion: envio.direccion,
      estado,
      codigopostal: envio.codigoPostal,
      idzona: idzonaResuelta,
      fechaentrega: estado === 'Entregado' ? envio.fechaEntrega : null,
    };

    let paquete;
    if (existente) {
      const updateData = { ...paqueteData };
      if (idTransportista) updateData.idtransportista = idTransportista;
      // Solo completamos idempresa si el paquete no la tenía (no reasignamos
      // un paquete de otra empresa que se re-escanee).
      if (existente.idempresa == null && idEmpresa != null) updateData.idempresa = idEmpresa;
      const { data, error: upErr } = await supabase
        .from('paquete')
        .update(updateData)
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
          idtransportista: idTransportista,
          idempresa: idEmpresa,
          ...paqueteData,
        })
        .select()
        .single();
      if (insErr) throw new Error(insErr.message);
      paquete = data;
      console.log(`[PacKen] Paquete insertado (id=${paquete.id})`);
    }

    return res.status(200).json({ ok: true, paquete, envio });
  } catch (err) {
    console.error('[PacKen] Error en escanear:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
