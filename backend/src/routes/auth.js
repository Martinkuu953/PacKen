import { Router } from 'express';
import { registrar, login } from '../services/auth.js';

const router = Router();

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, dni, rol } = req.body ?? {};
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, password y rol son requeridos' });
    }
    if (!['transportista', 'empresa'].includes(rol)) {
      return res.status(400).json({ error: 'rol debe ser "transportista" o "empresa"' });
    }
    if (rol === 'transportista' && !dni) {
      return res.status(400).json({ error: 'DNI es requerido para transportistas' });
    }
    const result = await registrar({ nombre, email, password, dni, rol });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El email o DNI ya está registrado' });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identificador, password } = req.body ?? {};
    if (!identificador || !password) {
      return res.status(400).json({ error: 'identificador y password son requeridos' });
    }
    const result = await login(identificador, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

export default router;
