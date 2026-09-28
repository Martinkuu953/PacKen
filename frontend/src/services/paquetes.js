import { apiFetch } from './api.js';
import { ESTADOS } from '../utils/estados.js';

function mapPaquete(row) {
  return {
    // public_id (UUID) del paquete: es lo que esperan cambiar-estado y reasignar.
    id: row.id ?? null,
    idenvioml: row.idenvioml ?? row.id ?? '',
    comprador: row.comprador ?? '',
    direccion: row.direccion ?? '',
    estado: row.estado ?? '',
    codigopostal: row.codigopostal ?? '',
    // zona y partido son dos cosas distintas y las dos viajan: el partido es lo
    // que lista la pantalla de Paquetes, y la zona la que agrupa Estadísticas.
    zona: row.zona ?? null,
    partido: row.partido ?? null,
    seller: row.seller ?? null,
    sellerId: row.sellerId ?? null,
    transportista: row.transportista ?? null,
    transportistaId: row.transportistaId ?? null,
    fechaingreso: row.fechaingreso ?? null,
    fechaentrega: row.fechaentrega ?? null,
  };
}

export async function getPaquetes(filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== '' && valor != null) params.set(clave, valor);
  }
  const qs = params.toString();
  const data = await apiFetch(`/api/paquetes${qs ? `?${qs}` : ''}`);
  return {
    paquetes: (data.paquetes ?? []).map(mapPaquete),
    origen: data.origen ?? 'api',
    aviso: data.aviso ?? null,
  };
}

export async function cambiarEstado(id, estado) {
  return apiFetch('/api/paquetes/cambiar-estado', {
    method: 'POST',
    body: JSON.stringify({ id, estado }),
  });
}

export async function marcarEntregado(id) {
  return cambiarEstado(id, ESTADOS.ENTREGADO);
}

export async function reasignarTransportista(id, idtransportista) {
  return apiFetch('/api/paquetes/reasignar', {
    method: 'POST',
    body: JSON.stringify({ id, idtransportista }),
  });
}

// Entrega solo los paquetes elegidos (public_id). El servidor omite los que no
// estén En camino o no sean de la empresa.
export async function entregarPaquetes(ids) {
  return apiFetch('/api/paquetes/entregar', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function getHistorialPaquete(id) {
  const data = await apiFetch(`/api/paquetes?historial=${encodeURIComponent(id)}`);
  return data.historial ?? [];
}
