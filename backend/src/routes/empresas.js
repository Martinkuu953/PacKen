import { Router } from 'express';
import { query } from '../lib/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    // Endpoint público (lo consume el formulario de registro): el id interno
    // no sale, el cliente elige la empresa por su UUID opaco.
    const { rows } = await query(
      "SELECT public_id AS id, nombre FROM usuario WHERE rol = 'empresa' ORDER BY nombre",
    );
    res.json({ empresas: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
