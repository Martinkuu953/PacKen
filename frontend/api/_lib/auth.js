import { getSupabase } from './ml.js';

export async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) throw new Error('No autorizado: falta token');

  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('No autorizado: token inválido');

  return { user, supabase };
}

export async function requireEmpresa(req) {
  const { user, supabase } = await getAuthenticatedUser(req);

  const { data: empresa, error } = await supabase
    .from('empresa')
    .select('id, nombre, email')
    .eq('id', user.id)
    .single();

  if (error || !empresa) throw new Error('No autorizado: el usuario no es una empresa');

  return { user, empresa, supabase };
}
