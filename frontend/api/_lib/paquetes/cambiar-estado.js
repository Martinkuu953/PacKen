import { getSupabase } from '../ml.js';
import { autenticar } from '../auth.js';
import { ESTADOS, canonizarEstado } from '../../../shared/estados.js';
import { ErrorPublico, responderError } from '../errores.js';
import { esUuid, paquetePublico } from './comun.js';

const ESTADOS_TRANSPORTISTA = [ESTADOS.ENTREGADO, ESTADOS.REPROGRAMADO];

// POST /api/paquetes/cambiar-estado  { id, estado }
// `id` es el public_id (UUID) del paquete.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;

  try {
    const { id, estado } = req.body ?? {};

    if (!id || !estado) {
      return res.status(400).json({ error: 'id y estado son requeridos' });
    }
    if (!esUuid(id)) {
      return res.status(400).json({ error: 'id de paquete inválido' });
    }
    const estadoCanonico = canonizarEstado(estado);
    if (!estadoCanonico) {
      return res.status(400).json({ error: `Estado inválido: "${estado}"` });
    }

    const supabase = getSupabase();

    const { data: paquete } = await supabase
      .from('paquete')
      .select('id, estado, idempresa, idtransportista')
      .eq('public_id', id)
      .maybeSingle();

    const propio =
      paquete &&
      (usuario.rol === 'transportista'
        ? paquete.idtransportista === usuario.id
        : usuario.rol === 'empresa' && paquete.idempresa === usuario.id);

    // Mismo mensaje para "no existe" y "no es tuyo": no confirmamos la
    // existencia de paquetes ajenos.
    if (!propio) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }

    // El transportista solo informa lo que pasó en la calle. Cancelar o
    // devolver un paquete a "Ingresado" mueve facturas y liquidaciones, y eso
    // lo decide la empresa.
    if (usuario.rol === 'transportista' && !ESTADOS_TRANSPORTISTA.includes(estadoCanonico)) {
      return res.status(403).json({ error: 'No tenés permiso para poner ese estado' });
    }

    // Un paquete solo se entrega si salió a reparto: marcar como entregado algo
    // que sigue en depósito (o que ya se entregó) descuadra la facturación,
    // porque el monto se calcula sobre los entregados.
    if (estadoCanonico === ESTADOS.ENTREGADO) {
      const estadoActual = canonizarEstado(paquete.estado);
      if (estadoActual !== ESTADOS.EN_CAMINO) {
        return res.status(409).json({
          error: `Solo se puede entregar un paquete en camino (este está "${paquete.estado}")`,
        });
      }
    }

    const updateData = {
      estado: estadoCanonico,
      // Quién y por dónde: lo toma el trigger de paquete_historial.
      ultimo_cambio_por: usuario.id,
      ultimo_cambio_origen: 'manual',
    };
    if (estadoCanonico === ESTADOS.ENTREGADO) {
      updateData.fechaentrega = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('paquete')
      .update(updateData)
      .eq('id', paquete.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new ErrorPublico('Paquete no encontrado', 404);

    console.log(`[PacKen] Paquete ${paquete.id} → estado="${estadoCanonico}" (usuario ${usuario.id})`);
    return res.status(200).json({ ok: true, paquete: paquetePublico(data) });
  } catch (err) {
    return responderError(res, err, 400, 'cambiar-estado');
  }
}
