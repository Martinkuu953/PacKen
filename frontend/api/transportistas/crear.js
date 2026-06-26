import { requireEmpresa } from '../_lib/auth.js';

// POST /api/transportistas/crear  { nombre, email, telefono, password }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { empresa, supabase } = await requireEmpresa(req);
    const { nombre, email, telefono, password } = req.body ?? {};

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'nombre, email y password son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

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

    const { data: transportista, error: insertError } = await supabase
      .from('transportista')
      .insert({ id: userId, nombre, email, telefono: telefono || null, id_empresa: empresa.id })
      .select()
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(insertError.message);
    }

    console.log(`[PacKen] Transportista creado: ${nombre} (${email}) para empresa ${empresa.nombre}`);
    return res.status(200).json({ ok: true, transportista });
  } catch (err) {
    console.error('[PacKen] Error en crear transportista:', err.message);
    const status = err.message.startsWith('No autorizado') ? 401 : 400;
    return res.status(status).json({ error: err.message });
  }
}
