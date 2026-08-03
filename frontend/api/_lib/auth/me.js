import { autenticar, perfilPublico } from '../auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // autenticar() ya trae el perfil fresco de la DB resolviendo el public_id
  // del token, así que no hace falta una segunda consulta.
  const usuario = await autenticar(req, res);
  if (!usuario) return;

  return res.json({ usuario: perfilPublico(usuario) });
}
