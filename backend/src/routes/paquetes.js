import { Router } from 'express';
import { listarPaquetes } from '../services/paquetes.js';
import { procesarEscaneoQR } from '../services/mercadoLibre.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const json = await listarPaquetes();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nuevo endpoint: recibe el shipmentId leído del QR + el tipo de operación (colecta|reparto)
router.post('/escanear', async (req, res) => {
  try {
    const { shipmentId, sellerId, tipo } = req.body ?? {};
    if (!shipmentId || !sellerId || !tipo) {
      return res.status(400).json({ error: 'shipmentId, sellerId y tipo son requeridos' });
    }

    const resultado = await procesarEscaneoQR(String(shipmentId), String(sellerId), tipo);
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;