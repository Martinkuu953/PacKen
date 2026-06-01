import { Router } from 'express';
import { obtenerDatosEnvio } from '../services/mercadoLibre.js';

const router = Router();

router.get('/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { sellerId } = req.query;
    const datos = await obtenerDatosEnvio(shipmentId, sellerId);
    res.json(datos);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
