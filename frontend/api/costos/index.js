import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// /api/costos — lista de costos por transportista + zona.
//
//   GET     → { costos, transportistas, zonas }  (transportistas y zonas
//                                            para los selects del alta: evita
//                                            endpoints extra, el plan Hobby
//                                            permite 12 funciones)
//   POST    → alta/edición de una tarifa    { transportistaId, zonaId, costo }
//   DELETE  → baja de una tarifa            ?id=<public_id>
//
// Los transportistas no tienen tabla propia: son filas de "usuario" con
// rol = 'transportista' (mismo criterio que /api/solicitudes).
//
// Todo filtrado por la empresa del token: una empresa solo ve y toca su lista.

function parsearImporte(valor, campo) {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
    throw new Error(`${campo} debe ser un número`);
  }
  if (numero < 0) throw new Error(`${campo} no puede ser negativo`);
  return numero;
}

async function listar(supabase, idempresa, res) {
  const [tarifas, transportistas, zonas] = await Promise.all([
    supabase
      .from('lista_costos')
      .select('public_id, idtransportista, idzona, costo')
      .eq('idempresa', idempresa),
    supabase
      .from('usuario')
      .select('id, public_id, nombre')
      .eq('idempresa', idempresa)
      .eq('rol', 'transportista')
      .eq('estado_solicitud', 'aceptado')
      .order('nombre'),
    supabase.from('zona').select('id, public_id, nombre, cp_desde, cp_hasta').order('nombre'),
  ]);

  for (const r of [tarifas, transportistas, zonas]) {
    if (r.error) throw new Error(r.error.message);
  }

  // Resolvemos los nombres en memoria en lugar de con joins embebidos de
  // PostgREST: son tablas chicas y así el id interno nunca sale de acá.
  const transportistaPorId = new Map((transportistas.data ?? []).map((t) => [t.id, t]));
  const zonaPorId = new Map((zonas.data ?? []).map((z) => [z.id, z]));

  const costos = (tarifas.data ?? [])
    .map((t) => {
      const transportista = transportistaPorId.get(t.idtransportista);
      const zona = zonaPorId.get(t.idzona);
      return {
        id: t.public_id,
        transportistaId: transportista?.public_id ?? null,
        transportistaNombre: transportista?.nombre ?? '—',
        zonaId: zona?.public_id ?? null,
        zonaNombre: zona?.nombre ?? '—',
        costo: Number(t.costo),
      };
    })
    .sort(
      (a, b) =>
        a.transportistaNombre.localeCompare(b.transportistaNombre) ||
        a.zonaNombre.localeCompare(b.zonaNombre),
    );

  return res.json({
    costos,
    transportistas: (transportistas.data ?? []).map((t) => ({ id: t.public_id, nombre: t.nombre })),
    zonas: (zonas.data ?? []).map((z) => ({
      id: z.public_id,
      nombre: z.nombre,
      cpDesde: z.cp_desde,
      cpHasta: z.cp_hasta,
    })),
  });
}

async function guardar(supabase, idempresa, req, res) {
  const { transportistaId, zonaId, costo } = req.body ?? {};

  if (!transportistaId || !zonaId) {
    return res.status(400).json({ error: 'transportistaId y zonaId son requeridos' });
  }

  const costoNum = parsearImporte(costo, 'costo');

  // El transportista tiene que ser de esta empresa: si no, una empresa
  // podría tarifar transportistas ajenos pasando cualquier UUID.
  const { data: transportista } = await supabase
    .from('usuario')
    .select('id')
    .eq('public_id', transportistaId)
    .eq('idempresa', idempresa)
    .eq('rol', 'transportista')
    .maybeSingle();

  if (!transportista) {
    return res.status(404).json({ error: 'El transportista no existe o no es de tu empresa' });
  }

  const { data: zona } = await supabase
    .from('zona')
    .select('id')
    .eq('public_id', zonaId)
    .maybeSingle();

  if (!zona) return res.status(404).json({ error: 'La zona no existe' });

  // Upsert sobre (idempresa, idtransportista, idzona): volver a cargar la
  // misma combinación actualiza la tarifa en vez de duplicarla.
  const { data, error } = await supabase
    .from('lista_costos')
    .upsert(
      {
        idempresa,
        idtransportista: transportista.id,
        idzona: zona.id,
        costo: costoNum,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'idempresa,idtransportista,idzona' },
    )
    .select('public_id')
    .single();

  if (error) throw new Error(error.message);

  return res.status(200).json({ ok: true, id: data.public_id });
}

async function borrar(supabase, idempresa, req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id es requerido' });

  const { data, error } = await supabase
    .from('lista_costos')
    .delete()
    .eq('public_id', id)
    .eq('idempresa', idempresa)
    .select('public_id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return res.status(404).json({ error: 'Tarifa no encontrada' });

  return res.json({ ok: true });
}

export default async function handler(req, res) {
  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    const supabase = getSupabase();

    if (req.method === 'GET') return await listar(supabase, usuario.id, res);
    if (req.method === 'POST') return await guardar(supabase, usuario.id, req, res);
    if (req.method === 'DELETE') return await borrar(supabase, usuario.id, req, res);

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[PacKen] Error en /api/costos:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
