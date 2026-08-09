import { getSupabase } from '../_lib/ml.js';
import { autenticar, requiereRol } from '../_lib/auth.js';

// GET /api/sellers — un seller por fila con sus paquetes agrupados por
// estado y el monto facturado (entregados), todo calculado en el momento a
// partir de paquete + la lista de precios (tipo='precio') a la que
// pertenezca el seller: no hay columnas de estadísticas precalculadas en
// "seller".
//
// Todo filtrado por la empresa del token, mismo criterio que /api/precios.

function normalizarEstado(estado) {
  return String(estado ?? '').toLowerCase().trim();
}

function resumenVacio() {
  return { totales: 0, ingresados: 0, enCamino: 0, demorados: 0, entregados: 0, cancelados: 0, reprogramados: 0, monto: 0 };
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

    // Las listas de precios de esta empresa: hacen falta primero para poder
    // traer solo sus miembros y montos por zona.
    const listasPrecio = await supabase.from('lista').select('id').eq('idempresa', idempresa).eq('tipo', 'precio');
    if (listasPrecio.error) throw new Error(`lista: ${listasPrecio.error.message}`);
    const idListas = (listasPrecio.data ?? []).map((l) => l.id);

    const [sellers, paquetes, miembros, montos] = await Promise.all([
      supabase.from('seller').select('id, public_id, nombre').eq('idempresa', idempresa).order('nombre'),
      supabase.from('paquete').select('idseller, idzona, estado').eq('idempresa', idempresa),
      idListas.length > 0
        ? supabase.from('lista_miembro_seller').select('idlista, idseller').in('idlista', idListas)
        : Promise.resolve({ data: [], error: null }),
      idListas.length > 0
        ? supabase.from('lista_zona_monto').select('idlista, idzona, monto').in('idlista', idListas)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (sellers.error) throw new Error(`seller: ${sellers.error.message}`);
    if (paquetes.error) throw new Error(`paquete: ${paquetes.error.message}`);
    if (miembros.error) throw new Error(`lista_miembro_seller: ${miembros.error.message}`);
    if (montos.error) throw new Error(`lista_zona_monto: ${montos.error.message}`);

    // Lista de precios a la que pertenece cada seller, y precio vigente por
    // (lista, zona): sirve para valorizar los entregados sin guardar el
    // monto en cada paquete.
    const listaPorSeller = new Map((miembros.data ?? []).map((m) => [m.idseller, m.idlista]));
    const precioPorListaZona = new Map(
      (montos.data ?? []).map((m) => [`${m.idlista}-${m.idzona}`, Number(m.monto)]),
    );

    const resumenPorSeller = new Map();
    for (const p of paquetes.data ?? []) {
      if (!resumenPorSeller.has(p.idseller)) resumenPorSeller.set(p.idseller, resumenVacio());
      const resumen = resumenPorSeller.get(p.idseller);
      acumular(resumen, p.estado);

      if (normalizarEstado(p.estado).includes('entregad')) {
        const idlista = listaPorSeller.get(p.idseller);
        resumen.monto += (idlista != null ? precioPorListaZona.get(`${idlista}-${p.idzona}`) : undefined) ?? 0;
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
