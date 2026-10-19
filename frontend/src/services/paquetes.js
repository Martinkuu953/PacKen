import { apiFetch } from './api.js';

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
    // que listan Paquetes y Estadísticas; la zona define la tarifa.
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

function queryString(filtros) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== '' && valor != null) params.set(clave, valor);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Una página del listado. Además de los filtros acepta pagina, limite, orden,
// dir y q (búsqueda en el servidor).
export async function getPaquetes(filtros = {}) {
  const data = await apiFetch(`/api/paquetes${queryString(filtros)}`);
  const paquetes = (data.paquetes ?? []).map(mapPaquete);
  return {
    paquetes,
    total: data.total ?? paquetes.length,
    pagina: data.pagina ?? 1,
    limite: data.limite ?? paquetes.length,
    origen: data.origen ?? 'api',
    aviso: data.aviso ?? null,
  };
}

// Cantidades por estado, calculadas en el servidor: { total, porEstado }.
export async function getResumenPaquetes(filtros = {}) {
  return apiFetch(`/api/paquetes${queryString({ ...filtros, vista: 'resumen' })}`);
}

// Estadísticas por partido, calculadas en el servidor: { filas, totales }.
export async function getEstadisticasPaquetes(filtros = {}) {
  return apiFetch(`/api/paquetes${queryString({ ...filtros, vista: 'estadisticas' })}`);
}

export async function cambiarEstado(id, estado) {
  return apiFetch('/api/paquetes/cambiar-estado', {
    method: 'POST',
    body: JSON.stringify({ id, estado }),
  });
}

export async function reasignarTransportista(id, idtransportista) {
  return apiFetch('/api/paquetes/reasignar', {
    method: 'POST',
    body: JSON.stringify({ id, idtransportista }),
  });
}

export async function getHistorialPaquete(id) {
  const data = await apiFetch(`/api/paquetes?historial=${encodeURIComponent(id)}`);
  return data.historial ?? [];
}
