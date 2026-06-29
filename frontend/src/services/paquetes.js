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
  const data = await apiFetch('/api/paquetes');
  return {
    paquetes: (data.paquetes ?? []).map(mapPaquete),
    origen: data.origen ?? 'api',
    aviso: data.aviso ?? null,
  };
}

export async function marcarEntregado(id) {
  return apiFetch('/api/paquetes/cambiar-estado', {
    method: 'POST',
    body: JSON.stringify({ id, estado: 'Entregado' }),
  });
}

export async function simularEntregas() {
  return apiFetch('/api/paquetes/simular-entregas', { method: 'POST' });
}
