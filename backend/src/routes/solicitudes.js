import { Router } from 'express';
import { query } from '../lib/db.js';
import { autenticar, requiereRol } from '../middleware/auth.js';

const router = Router();

router.get('/', autenticar, requiereRol('empresa'), async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nombre, email, dni, estado_solicitud, created_at
       FROM usuario
       WHERE rol = 'transportista' AND idempresa = $1
       ORDER BY created_at DESC`,
      [req.usuario.id],
    );
    res.json({ solicitudes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', autenticar, requiereRol('empresa'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body ?? {};

    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser "aceptado" o "rechazado"' });
    }

    const { rows } = await query(
      `UPDATE usuario SET estado_solicitud = $1
       WHERE id = $2 AND rol = 'transportista' AND idempresa = $3
       RETURNING id, nombre, email, dni, estado_solicitud`,
      [estado, Number(id), req.usuario.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json({ ok: true, transportista: rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
