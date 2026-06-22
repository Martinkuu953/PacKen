import { Router } from 'express';
import { obtenerDatosEnvio } from '../services/mercadoLibre.js';
import { query } from '../lib/db.js';

const router = Router();

router.get('/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { sellerId } = req.query;

    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId es requerido (query param)' });
    }

    const { rows } = await query(
      'SELECT id FROM seller WHERE idmercadolibre = $1 LIMIT 1',
      [String(sellerId)]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: `No existe seller con idmercadolibre = ${sellerId}` });
    }

    const datos = await obtenerDatosEnvio(shipmentId, rows[0].id);
    res.json(datos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
