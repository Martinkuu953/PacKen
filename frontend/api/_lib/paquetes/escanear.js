import {
  getSupabase,
  resolverSellerInterno,
  obtenerShipment,
  decidirEstadoDeEscaneo,
  TIPOS_ESCANEO,
} from '../ml.js';
import { autenticar } from '../auth.js';
import { ESTADOS } from '../../../shared/estados.js';
import { responderError } from '../errores.js';

// Registra el barrio del envío en area_flex (si es nuevo, sin zona) y devuelve
// { idarea, idzona }.
//
// idarea es lo que importa de acá en adelante: con el mapeo barrio→zona por
// lista, un paquete tiene una zona distinta según se lo mire desde la lista del
// seller o la del transportista, así que la zona no se puede congelar. El
// barrio sí, y de él se derivan las dos.
//
// idzona se sigue guardando como el default de la empresa al momento del
// escaneo: es lo que se muestra en los listados y la red para los paquetes
// viejos. Si no hay empresa, ni barrio, ni asignación, cae en la zona General
// (id=1), que es el fallback histórico.
export async function resolverZonaYRegistrarArea(supabase, idEmpresa, envio) {
  const ref = envio.barrioRef;
  if (idEmpresa == null || !ref) {
    console.warn(
      `[PacKen] Sin barrio para el envío ${envio.idEnvioMl}: el paquete queda sin partido ` +
        `(empresa=${idEmpresa}, barrio="${envio.barrio ?? ''}")`,
    );
    return { idarea: null, idzona: 1 };
  }

  // Los errores de acá NO cortan el escaneo (registrar el barrio es
  // best-effort), pero se loguean: hasta que se los empezó a mirar, un upsert
  // que fallaba dejaba el paquete sin idarea en silencio, sin partido en la
  // lista y liquidando contra la zona General, que no tiene tarifa.
  //
  // ignoreDuplicates: si el barrio ya existe no lo pisamos (preserva su zona).
  const { error: errUpsert } = await supabase
    .from('area_flex')
    .upsert(
      { idempresa: idEmpresa, nombre: envio.barrio || ref, ml_ref: ref },
      { onConflict: 'idempresa,ml_ref', ignoreDuplicates: true },
    );
  if (errUpsert) {
    console.error(`[PacKen] No se pudo registrar el barrio "${ref}" en area_flex:`, errUpsert.message);
  }

  const { data, error: errSelect } = await supabase
    .from('area_flex')
    .select('id, idzona')
    .eq('idempresa', idEmpresa)
    .eq('ml_ref', ref)
    .maybeSingle();
  if (errSelect) {
    console.error(`[PacKen] No se pudo leer el barrio "${ref}" de area_flex:`, errSelect.message);
  }
  if (!data) {
    console.warn(
      `[PacKen] El barrio "${ref}" (empresa ${idEmpresa}) no quedó en area_flex: ` +
        'el paquete se guarda sin partido y con la zona General.',
    );
  }

  return { idarea: data?.id ?? null, idzona: data?.idzona ?? 1 };
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
    if (!TIPOS_ESCANEO.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido: debe ser "colecta" o "reparto"' });
    }

    const supabase = getSupabase();

    // Empresa dueña del paquete: la empresa misma si escanea directo, o la
    // empresa del transportista que escanea. Todo lo que sigue se acota a ella.
    const idEmpresa = usuario.rol === 'empresa' ? usuario.id : (usuario.idempresa ?? null);
    if (idEmpresa == null) {
      return res.status(403).json({ error: 'Tu usuario no está asociado a ninguna empresa' });
    }

    // El sellerId sale del QR escaneado, o sea de una fuente que el usuario
    // controla: hay que validarlo contra su empresa, no confiar en el papel.
    const idSellerInterno = await resolverSellerInterno(supabase, sellerId, idEmpresa);

    console.log(`[PacKen] Escaneo ${tipo} → shipment ${shipmentId}, seller ${sellerId} (interno ${idSellerInterno})`);

    const envio = await obtenerShipment(supabase, idSellerInterno, shipmentId);

    // Acotado por empresa, pero permitiendo adoptar paquetes huérfanos
    // (idempresa NULL): son paquetes viejos de antes de que existiera esta
    // columna, que quedan así hasta que alguien los vuelve a escanear (ver
    // migration-paquete-empresa.sql). Filtrar por ".eq('idempresa', idEmpresa)"
    // a secas los deja invisibles para siempre y, peor, hace que se inserte un
    // paquete DUPLICADO con el mismo idenvioml en cada re-escaneo. Lo que sí
    // hay que evitar es adoptar un paquete que ya es de OTRA empresa.
    const { data: existente } = await supabase
      .from('paquete')
      .select('id, estado, idempresa, fechaentrega')
      .eq('idenvioml', envio.idEnvioMl)
      .or(`idempresa.eq.${idEmpresa},idempresa.is.null`)
      .limit(1)
      .maybeSingle();

    // Colecta deja "Ingresado"; reparto toma el estado real de ML si ML ya sabe
    // algo del envío, y "En camino" si todavía no. La regla completa, con el por
    // qué de cada caso, está en decidirEstadoDeEscaneo (_lib/ml.js), compartida
    // con el webhook y el sync.
    const estado = decidirEstadoDeEscaneo(tipo, existente?.estado, envio.estadoMl);

    console.log(
      `[PacKen] Estado ML="${envio.estadoMl}" (sub="${envio.subestadoMl}") → estado interno="${estado}"`
    );

    const idTransportista = usuario.rol === 'transportista' ? usuario.id : null;

    // Zona por el barrio/municipio del envío (mapeo barrio→zona de la empresa).
    // Para un paquete ya existente usamos su empresa; si no, la del escaneo.
    const idEmpresaPaquete = existente?.idempresa ?? idEmpresa;
    const { idarea, idzona } = await resolverZonaYRegistrarArea(supabase, idEmpresaPaquete, envio);

    const paqueteData = {
      comprador: envio.comprador,
      direccion: envio.direccion,
      estado,
      codigopostal: envio.codigoPostal,
      idarea,
      idzona,
      // El status crudo de ML se guarda igual que en el webhook y en el sync: es
      // lo único que después explica por qué el paquete quedó donde quedó. Y el
      // escaneo cuenta como una consulta a ML, así que también mueve la cola del
      // sync (ml_sincronizado_en): el paquete recién escaneado es el que menos
      // falta hace volver a consultar.
      estadoml: envio.estadoMl,
      subestadoml: envio.subestadoMl,
      ml_sincronizado_en: new Date().toISOString(),
      // ML no siempre manda date_delivered; antes que dejar un entregado sin
      // fecha (no se puede liquidar: el período se filtra por fechaentrega) se
      // conserva la que ya tenía, y si tampoco hay, el momento del escaneo.
      fechaentrega:
        estado === ESTADOS.ENTREGADO
          ? envio.fechaEntrega || existente?.fechaentrega || new Date().toISOString()
          : null,
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
    return responderError(res, err, 400, 'escanear');
  }
}
