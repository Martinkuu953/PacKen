import { getSupabase } from '../_lib/ml.js';

// POST /api/auth/registrar-empresa  { email, password, nombre }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, nombre } = req.body ?? {};

    if (!email || !password || !nombre) {
      return res.status(400).json({ error: 'email, password y nombre son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const supabase = getSupabase();

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      const msg = authError.message.includes('already been registered')
        ? 'El email ya está registrado'
        : authError.message;
      throw new Error(msg);
    }

    const userId = authData.user.id;

    const { error: insertError } = await supabase
      .from('empresa')
      .insert({ id: userId, nombre, email });

    if (insertError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(insertError.message);
    }

    console.log(`[PacKen] Empresa registrada: ${nombre} (${email}), user=${userId}`);
    return res.status(200).json({ ok: true, user: { id: userId, email, nombre } });
  } catch (err) {
    console.error('[PacKen] Error en registrar-empresa:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
