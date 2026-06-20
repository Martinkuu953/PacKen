import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase para leer datos directamente desde el frontend.
// Se pueden sobreescribir con env vars (frontend/.env local o Environment Variables de Vercel),
// pero dejamos un fallback para que la demo funcione sin depender de esa config.
// OK porque la "publishable key" es pública por diseño (viaja en el bundle) y la tabla tiene RLS off.
// Para producción real: usar solo env vars y activar RLS con una policy de solo lectura.
const FALLBACK_URL = 'https://xxgzqjuuuhzztfuoxwts.supabase.co';
const FALLBACK_KEY = 'sb_publishable_7IrGnD1PWjn04ZyT-1WM4g_2zYeMRx0';

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;

export const supabaseConfigurado = Boolean(url && key);

export const supabase = supabaseConfigurado ? createClient(url, key) : null;
