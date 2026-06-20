import { supabase, supabaseConfigurado } from './supabase.js';

// Pasa una fila de la tabla "paquete" al formato que usa la UI.
function mapPaquete(row) {
  return {
    id: row.id ?? row.idenvioml ?? '',
    idenvioml: row.idenvioml ?? row.id ?? '',
    comprador: row.comprador ?? '',
    direccion: row.direccion ?? '',
    estado: row.estado ?? '',
  };
}

// Lee los paquetes directamente desde Supabase (sirve igual en local y en Vercel,
// sin depender de que el backend Express esté corriendo).
export async function getPaquetes() {
  if (!supabaseConfigurado) {
    return {
      paquetes: [],
      origen: 'sin-config',
      aviso: 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (ver frontend/.env o las env vars de Vercel).',
    };
  }

  const { data, error } = await supabase.from('paquete').select('*');
  if (error) throw new Error(error.message);

  return { paquetes: (data ?? []).map(mapPaquete), origen: 'supabase' };
}
