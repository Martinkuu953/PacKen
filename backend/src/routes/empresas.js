import { Router } from 'express';
import { query } from '../lib/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, nombre FROM usuario WHERE rol = 'empresa' ORDER BY nombre",
    );
    res.json({ empresas: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
