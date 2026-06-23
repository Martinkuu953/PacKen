import { supabase, supabaseConfigurado } from './supabase.js';
import { apiFetch } from './api.js';

function mapPaquete(row) {
  return {
    id: row.id ?? row.idenvioml ?? '',
    idenvioml: row.idenvioml ?? row.id ?? '',
    comprador: row.comprador ?? '',
    direccion: row.direccion ?? '',
    estado: row.estado ?? '',
    codigopostal: row.codigopostal ?? '',
    fechaingreso: row.fechaingreso ?? null,
    fechaentrega: row.fechaentrega ?? null,
  };
}

export async function getPaquetes() {
  if (!supabaseConfigurado) {
    return {
      paquetes: [],
      origen: 'sin-config',
      aviso: 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (ver frontend/.env o las env vars de Vercel).',
    };
  }

  const { data, error } = await supabase
    .from('paquete')
    .select('*')
    .order('fechaingreso', { ascending: false });

  if (error) throw new Error(error.message);

  return { paquetes: (data ?? []).map(mapPaquete), origen: 'supabase' };
}

export async function marcarEntregado(id) {
  return apiFetch(`/api/paquetes/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: 'Entregado' }),
  });
}

export async function simularEntregas() {
  return apiFetch('/api/paquetes/simular-entregas', { method: 'POST' });
}
