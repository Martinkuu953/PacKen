import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[PacKen] SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados — endpoints de vendedores fallarán.');
}

export const supabase = url && key ? createClient(url, key) : null;
