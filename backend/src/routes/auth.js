import { Router } from 'express';
import { registrar, login, obtenerUsuario, perfilPublico } from '../services/auth.js';
import { firmarAccessToken } from '../lib/jwt.js';
import { REFRESH_COOKIE_NAME, setRefreshCookie, clearRefreshCookie } from '../lib/cookies.js';
import { crearRefreshToken, rotarRefreshToken, revocarRefreshToken } from '../services/refreshTokens.js';

const router = Router();

router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, dni, rol, idempresa } = req.body ?? {};
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, password y rol son requeridos' });
    }
    if (!['transportista', 'empresa'].includes(rol)) {
      return res.status(400).json({ error: 'rol debe ser "transportista" o "empresa"' });
    }
    if (rol === 'transportista' && !dni) {
      return res.status(400).json({ error: 'DNI es requerido para transportistas' });
    }
    if (rol === 'transportista' && !idempresa) {
      return res.status(400).json({ error: 'Debe seleccionar una empresa' });
    }
    const result = await registrar({ nombre, email, password, dni, rol, idempresa });
    const { token: refreshToken, expiresAt } = await crearRefreshToken(result.usuario.id);
    setRefreshCookie(res, refreshToken, expiresAt);
    res.status(201).json({ usuario: perfilPublico(result.usuario), token: result.token });
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
    const { token: refreshToken, expiresAt } = await crearRefreshToken(result.usuario.id);
    setRefreshCookie(res, refreshToken, expiresAt);
    res.json({ usuario: perfilPublico(result.usuario), token: result.token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  const tokenActual = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!tokenActual) {
    return res.status(401).json({ error: 'Refresh token requerido' });
  }

  try {
    const resultado = await rotarRefreshToken(tokenActual);
    if (resultado.status !== 'ok') {
      clearRefreshCookie(res);
      const mensajes = {
        invalid: 'Refresh token inválido',
        expired: 'Refresh token expirado',
        reused: 'Sesión inválida, iniciá sesión nuevamente',
      };
      return res.status(401).json({ error: mensajes[resultado.status] });
    }

    setRefreshCookie(res, resultado.token, resultado.expiresAt);
    const usuario = await obtenerUsuario(resultado.usuarioId);
    const token = firmarAccessToken(usuario);
    res.json({ usuario: perfilPublico(usuario), token });
  } catch (err) {
    clearRefreshCookie(res);
    res.status(400).json({ error: err.message });
  }
});

router.post('/logout', async (req, res) => {
  const tokenActual = req.cookies?.[REFRESH_COOKIE_NAME];
  await revocarRefreshToken(tokenActual).catch(() => {});
  clearRefreshCookie(res);
  res.json({ ok: true });
});

// El middleware de auth ya trae el perfil fresco de la DB resolviendo el
// public_id del token, así que no hace falta una segunda consulta.
router.get('/me', (req, res) => {
  res.json({ usuario: perfilPublico(req.usuario) });
});

export default router;
