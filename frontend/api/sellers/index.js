import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// GET /api/sellers — un seller por fila con sus paquetes agrupados por
// estado y el monto facturado (entregados), todo calculado en el momento a
// partir de paquete + lista_precios: no hay columnas de estadísticas
// precalculadas en "seller".
//
// Todo filtrado por la empresa del token, mismo criterio que /api/precios.

function normalizarEstado(estado) {
  return String(estado ?? '').toLowerCase().trim();
}

function resumenVacio() {
  return {
    totales: 0,
    ingresados: 0,
    enCamino: 0,
    demorados: 0,
    entregados: 0,
    cancelados: 0,
    reprogramados: 0,
    monto: 0,
  };
}

function acumular(resumen, estado) {
  const e = normalizarEstado(estado);
  resumen.totales += 1;
  if (e.includes('ingresad')) resumen.ingresados += 1;
  if (e.includes('atrasad') || e.includes('demorad')) resumen.demorados += 1;
  if (e.includes('camino')) resumen.enCamino += 1;
  if (e.includes('entregad')) resumen.entregados += 1;
  if (e.includes('cancel')) resumen.cancelados += 1;
  if (e.includes('reprogram')) resumen.reprogramados += 1;
}

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

    const [sellers, paquetes, listasPrecio] = await Promise.all([
      supabase
        .from('seller')
        .select('id, public_id, nombre, idlistaprecio')
        .eq('idempresa', idempresa)
        .order('nombre'),
      supabase.from('paquete').select('idseller, idzona, estado').eq('idempresa', idempresa),
      supabase.from('listaprecio').select('id').eq('idempresa', idempresa).eq('tipo', 'precio'),
    ]);

    if (sellers.error) throw new Error(`seller: ${sellers.error.message}`);
    if (paquetes.error) throw new Error(`paquete: ${paquetes.error.message}`);
    if (listasPrecio.error) throw new Error(`listaprecio: ${listasPrecio.error.message}`);

    const listaIds = (listasPrecio.data ?? []).map((l) => l.id);
    const detalle = listaIds.length
      ? await supabase.from('listaprecio_detalle').select('idlistaprecio, idzona, precio').in('idlistaprecio', listaIds)
      : { data: [], error: null };
    if (detalle.error) throw new Error(`listaprecio_detalle: ${detalle.error.message}`);

    // Precio vigente por (lista, zona): sirve para valorizar los entregados
    // sin guardar el monto en cada paquete. La lista de un seller sale de
    // seller.idlistaprecio.
    const precioPorListaZona = new Map(
      (detalle.data ?? []).map((d) => [`${d.idlistaprecio}-${d.idzona}`, Number(d.precio)]),
    );
    const idlistaPorSeller = new Map((sellers.data ?? []).map((s) => [s.id, s.idlistaprecio]));

    const resumenPorSeller = new Map();
    for (const p of paquetes.data ?? []) {
      if (!resumenPorSeller.has(p.idseller)) resumenPorSeller.set(p.idseller, resumenVacio());
      const resumen = resumenPorSeller.get(p.idseller);
      acumular(resumen, p.estado);

      if (normalizarEstado(p.estado).includes('entregad')) {
        const idlista = idlistaPorSeller.get(p.idseller);
        if (idlista != null) {
          resumen.monto += precioPorListaZona.get(`${idlista}-${p.idzona}`) ?? 0;
        }
      }
    }

    const listado = (sellers.data ?? []).map((s) => {
      const resumen = resumenPorSeller.get(s.id) ?? resumenVacio();
      return { id: s.public_id, nombre: s.nombre, ...resumen };
    });

    const montoTotal = listado.reduce((sum, s) => sum + s.monto, 0);

    return res.json({ sellers: listado, montoTotal });
  } catch (err) {
    console.error('[PacKen] Error en listar sellers:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
