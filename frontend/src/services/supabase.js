import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase para leer datos directamente desde el frontend.
// Las variables van en frontend/.env (local) y en las Environment Variables de Vercel.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(url && key);

export const supabase = supabaseConfigurado ? createClient(url, key) : null;
