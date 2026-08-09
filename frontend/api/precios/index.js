import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// /api/precios — lista de costos y precios por seller + zona.
//
//   GET     → { precios, sellers, zonas }   (sellers y zonas para los selects
//                                            del alta: evita endpoints extra,
//                                            el plan Hobby permite 12 funciones)
//   POST    → alta/edición de una tarifa    { sellerId, zonaId, costo, precio }
//   DELETE  → baja de una tarifa            ?id=<public_id>
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
  const [tarifas, sellers, zonas] = await Promise.all([
    supabase
      .from('lista_precios')
      .select('public_id, idseller, idzona, costo, precio')
      .eq('idempresa', idempresa),
    supabase.from('seller').select('id, public_id, nombre').eq('idempresa', idempresa).order('nombre'),
    supabase.from('zona').select('id, public_id, nombre, cp_desde, cp_hasta').order('nombre'),
  ]);

  for (const r of [tarifas, sellers, zonas]) {
    if (r.error) throw new Error(r.error.message);
  }

  // Resolvemos los nombres en memoria en lugar de con joins embebidos de
  // PostgREST: son tablas chicas y así el id interno nunca sale de acá.
  const sellerPorId = new Map((sellers.data ?? []).map((s) => [s.id, s]));
  const zonaPorId = new Map((zonas.data ?? []).map((z) => [z.id, z]));

  const precios = (tarifas.data ?? [])
    .map((t) => {
      const seller = sellerPorId.get(t.idseller);
      const zona = zonaPorId.get(t.idzona);
      return {
        id: t.public_id,
        sellerId: seller?.public_id ?? null,
        sellerNombre: seller?.nombre ?? '—',
        zonaId: zona?.public_id ?? null,
        zonaNombre: zona?.nombre ?? '—',
        costo: Number(t.costo),
        precio: Number(t.precio),
      };
    })
    .sort(
      (a, b) =>
        a.sellerNombre.localeCompare(b.sellerNombre) || a.zonaNombre.localeCompare(b.zonaNombre),
    );

  return res.json({
    precios,
    sellers: (sellers.data ?? []).map((s) => ({ id: s.public_id, nombre: s.nombre })),
    zonas: (zonas.data ?? []).map((z) => ({
      id: z.public_id,
      nombre: z.nombre,
      cpDesde: z.cp_desde,
      cpHasta: z.cp_hasta,
    })),
  });
}

async function guardar(supabase, idempresa, req, res) {
  const { sellerId, zonaId, costo, precio } = req.body ?? {};

  if (!sellerId || !zonaId) {
    return res.status(400).json({ error: 'sellerId y zonaId son requeridos' });
  }

  const costoNum = parsearImporte(costo, 'costo');
  const precioNum = parsearImporte(precio, 'precio');

  // El seller tiene que ser de esta empresa: si no, una empresa podría
  // tarifar sellers ajenos pasando cualquier UUID.
  const { data: seller } = await supabase
    .from('seller')
    .select('id')
    .eq('public_id', sellerId)
    .eq('idempresa', idempresa)
    .maybeSingle();

  if (!seller) return res.status(404).json({ error: 'El seller no existe o no es de tu empresa' });

  const { data: zona } = await supabase
    .from('zona')
    .select('id')
    .eq('public_id', zonaId)
    .maybeSingle();

  if (!zona) return res.status(404).json({ error: 'La zona no existe' });

  // Upsert sobre (idempresa, idseller, idzona): volver a cargar la misma
  // combinación actualiza la tarifa en vez de duplicarla.
  const { data, error } = await supabase
    .from('lista_precios')
    .upsert(
      {
        idempresa,
        idseller: seller.id,
        idzona: zona.id,
        costo: costoNum,
        precio: precioNum,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'idempresa,idseller,idzona' },
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
    .from('lista_precios')
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
    console.error('[PacKen] Error en /api/precios:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
