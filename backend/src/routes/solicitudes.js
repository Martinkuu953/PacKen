import { Router } from 'express';
import { query } from '../lib/db.js';
import { requiereRol } from '../middleware/auth.js';

const router = Router();

router.get('/', requiereRol('empresa'), async (req, res) => {
  try {
    // El cliente solo conoce el UUID opaco: es el identificador con el que
    // después hace el PATCH. Ni el id interno ni el email salen de acá.
    const { rows } = await query(
      `SELECT public_id AS id, nombre, dni, estado_solicitud, created_at
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

router.patch('/:id', requiereRol('empresa'), async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body ?? {};

    if (!['aceptado', 'rechazado'].includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser "aceptado" o "rechazado"' });
    }

    // `id` es el public_id (UUID opaco), no el id interno. El filtro por
    // idempresa sigue garantizando que una empresa solo toque a los suyos.
    const { rows } = await query(
      `UPDATE usuario SET estado_solicitud = $1
       WHERE public_id = $2 AND rol = 'transportista' AND idempresa = $3
       RETURNING public_id AS id, nombre, dni, estado_solicitud`,
      [estado, id, req.usuario.id],
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
