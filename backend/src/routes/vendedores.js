import { Router } from 'express';
import { registrarVendedor } from '../services/mercadoLibre.js';

const router = Router();

// Endpoint POST para dar de alta la vinculación OAuth de un Seller
router.post('/', async (req, res) => {
  try {
    const { sellerId, refreshToken } = req.body ?? {};
    if (!sellerId || !refreshToken) {
      return res.status(400).json({ error: 'sellerId y refreshToken son requeridos' });
    }
    
    const result = await registrarVendedor(sellerId, refreshToken);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;