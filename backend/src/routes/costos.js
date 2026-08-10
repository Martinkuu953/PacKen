import { Router } from 'express';
import { query } from '../lib/db.js';
import { requiereRol } from '../middleware/auth.js';

// Lista de costos por transportista + zona: costo = lo que la empresa le
// paga al transportista por esa entrega.
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

// GET /api/costos → { costos, transportistas, zonas }
// Devuelve también transportistas y zonas para los selects del alta.
router.get('/', async (req, res) => {
  try {
    const [tarifas, transportistas, zonas] = await Promise.all([
      query(
        `SELECT lc.public_id AS id,
                t.public_id  AS "transportistaId", t.nombre AS "transportistaNombre",
                z.public_id  AS "zonaId",           z.nombre AS "zonaNombre",
                lc.costo
           FROM lista_costos lc
           JOIN usuario t ON t.id = lc.idtransportista
           JOIN zona    z ON z.id = lc.idzona
          WHERE lc.idempresa = $1
          ORDER BY t.nombre, z.nombre`,
        [req.usuario.id],
      ),
      query(
        `SELECT public_id AS id, nombre
           FROM usuario
          WHERE rol = 'transportista' AND idempresa = $1 AND estado_solicitud = 'aceptado'
          ORDER BY nombre`,
        [req.usuario.id],
      ),
      query(
        'SELECT public_id AS id, nombre, cp_desde AS "cpDesde", cp_hasta AS "cpHasta" FROM zona ORDER BY nombre',
      ),
    ]);

    res.json({
      costos: tarifas.rows.map((t) => ({
        ...t,
        costo: Number(t.costo),
      })),
      transportistas: transportistas.rows,
      zonas: zonas.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/costos { transportistaId, zonaId, costo }
router.post('/', async (req, res) => {
  try {
    const { transportistaId, zonaId, costo } = req.body ?? {};
    if (!transportistaId || !zonaId) {
      return res.status(400).json({ error: 'transportistaId y zonaId son requeridos' });
    }

    const costoNum = parsearImporte(costo, 'costo');

    // El transportista tiene que ser de esta empresa: si no, se podrían
    // tarifar transportistas ajenos pasando cualquier UUID.
    const { rows: transportistas } = await query(
      `SELECT id FROM usuario WHERE public_id = $1 AND idempresa = $2 AND rol = 'transportista'`,
      [transportistaId, req.usuario.id],
    );
    if (!transportistas[0]) {
      return res.status(404).json({ error: 'El transportista no existe o no es de tu empresa' });
    }

    const { rows: zonas } = await query('SELECT id FROM zona WHERE public_id = $1', [zonaId]);
    if (!zonas[0]) return res.status(404).json({ error: 'La zona no existe' });

    // Volver a cargar la misma combinación actualiza la tarifa, no la duplica.
    const { rows } = await query(
      `INSERT INTO lista_costos (idempresa, idtransportista, idzona, costo)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (idempresa, idtransportista, idzona)
       DO UPDATE SET costo = EXCLUDED.costo, updated_at = NOW()
       RETURNING public_id AS id`,
      [req.usuario.id, transportistas[0].id, zonas[0].id, costoNum],
    );

    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/costos?id=<public_id>
router.delete('/', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id es requerido' });

    const { rows } = await query(
      'DELETE FROM lista_costos WHERE public_id = $1 AND idempresa = $2 RETURNING public_id',
      [id, req.usuario.id],
    );

    if (!rows[0]) return res.status(404).json({ error: 'Tarifa no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
