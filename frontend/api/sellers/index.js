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
  return { totales: 0, enCamino: 0, demorados: 0, entregados: 0, cancelados: 0, reprogramados: 0, monto: 0 };
}

function acumular(resumen, estado) {
  const e = normalizarEstado(estado);
  resumen.totales += 1;
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

    const sellers = await supabase
      .from('seller')
      .select('id, public_id, nombre')
      .eq('idempresa', idempresa)
      .order('nombre');
    if (sellers.error) throw new Error(`seller: ${sellers.error.message}`);

    const paquetes = await supabase.from('paquete').select('idseller, idzona, estado').eq('idempresa', idempresa);
    if (paquetes.error) throw new Error(`paquete: ${paquetes.error.message}`);

    const precios = await supabase.from('lista_precios').select('idseller, idzona, precio').eq('idempresa', idempresa);
    if (precios.error) throw new Error(`lista_precios: ${precios.error.message}`);

    // Precio vigente por (seller, zona): sirve para valorizar los entregados
    // sin guardar el monto en cada paquete.
    const precioPorSellerZona = new Map(
      (precios.data ?? []).map((p) => [`${p.idseller}-${p.idzona}`, Number(p.precio)]),
    );

    const resumenPorSeller = new Map();
    for (const p of paquetes.data ?? []) {
      if (!resumenPorSeller.has(p.idseller)) resumenPorSeller.set(p.idseller, resumenVacio());
      const resumen = resumenPorSeller.get(p.idseller);
      acumular(resumen, p.estado);

      if (normalizarEstado(p.estado).includes('entregad')) {
        resumen.monto += precioPorSellerZona.get(`${p.idseller}-${p.idzona}`) ?? 0;
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
