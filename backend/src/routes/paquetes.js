import { Router } from 'express';
import { listarPaquetes, cambiarEstado, simularEntregas } from '../services/paquetes.js';
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

router.patch('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body ?? {};
    if (!estado) {
      return res.status(400).json({ error: 'estado es requerido' });
    }

    const paquete = await cambiarEstado(Number(id), estado);
    res.json({ ok: true, paquete });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/simular-entregas', async (_req, res) => {
  try {
    const resultado = await simularEntregas();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;