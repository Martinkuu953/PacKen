import { Router } from 'express';
import { listarPaquetes } from '../services/paquetes.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const json = await listarPaquetes();
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
