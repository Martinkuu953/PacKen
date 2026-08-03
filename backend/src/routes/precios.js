import { Router } from 'express';
import { query } from '../lib/db.js';
import { requiereRol } from '../middleware/auth.js';

// Lista de costos y precios por seller + zona.
//   costo  = lo que la empresa le paga al transportista
//   precio = lo que le cobra al seller
// Todo filtrado por la empresa del token: cada una ve y toca solo su lista.

const router = Router();

router.use(requiereRol('empresa'));

function parsearImporte(valor, campo) {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) {
    throw new Error(`${campo} debe ser un número`);
  }
  if (numero < 0) throw new Error(`${campo} no puede ser negativo`);
  return numero;
}

// GET /api/precios → { precios, sellers, zonas }
// Devuelve también sellers y zonas para los selects del alta.
router.get('/', async (req, res) => {
  try {
    const [tarifas, sellers, zonas] = await Promise.all([
      query(
        `SELECT lp.public_id AS id,
                s.public_id  AS "sellerId", s.nombre AS "sellerNombre",
                z.public_id  AS "zonaId",   z.nombre AS "zonaNombre",
                lp.costo, lp.precio
           FROM lista_precios lp
           JOIN seller s ON s.id = lp.idseller
           JOIN zona   z ON z.id = lp.idzona
          WHERE lp.idempresa = $1
          ORDER BY s.nombre, z.nombre`,
        [req.usuario.id],
      ),
      query('SELECT public_id AS id, nombre FROM seller WHERE idempresa = $1 ORDER BY nombre', [
        req.usuario.id,
      ]),
      query(
        'SELECT public_id AS id, nombre, cp_desde AS "cpDesde", cp_hasta AS "cpHasta" FROM zona ORDER BY nombre',
      ),
    ]);

    res.json({
      precios: tarifas.rows.map((t) => ({
        ...t,
        costo: Number(t.costo),
        precio: Number(t.precio),
      })),
      sellers: sellers.rows,
      zonas: zonas.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/precios { sellerId, zonaId, costo, precio }
router.post('/', async (req, res) => {
  try {
    const { sellerId, zonaId, costo, precio } = req.body ?? {};
    if (!sellerId || !zonaId) {
      return res.status(400).json({ error: 'sellerId y zonaId son requeridos' });
    }

    const costoNum = parsearImporte(costo, 'costo');
    const precioNum = parsearImporte(precio, 'precio');

    // El seller tiene que ser de esta empresa: si no, se podrían tarifar
    // sellers ajenos pasando cualquier UUID.
    const { rows: sellers } = await query(
      'SELECT id FROM seller WHERE public_id = $1 AND idempresa = $2',
      [sellerId, req.usuario.id],
    );
    if (!sellers[0]) {
      return res.status(404).json({ error: 'El seller no existe o no es de tu empresa' });
    }

    const { rows: zonas } = await query('SELECT id FROM zona WHERE public_id = $1', [zonaId]);
    if (!zonas[0]) return res.status(404).json({ error: 'La zona no existe' });

    // Volver a cargar la misma combinación actualiza la tarifa, no la duplica.
    const { rows } = await query(
      `INSERT INTO lista_precios (idempresa, idseller, idzona, costo, precio)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempresa, idseller, idzona)
       DO UPDATE SET costo = EXCLUDED.costo, precio = EXCLUDED.precio, updated_at = NOW()
       RETURNING public_id AS id`,
      [req.usuario.id, sellers[0].id, zonas[0].id, costoNum, precioNum],
    );

    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/precios?id=<public_id>
router.delete('/', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id es requerido' });

    const { rows } = await query(
      'DELETE FROM lista_precios WHERE public_id = $1 AND idempresa = $2 RETURNING public_id',
      [id, req.usuario.id],
    );

    if (!rows[0]) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
