import { apiFetch } from './api.js';

export function parsearQR(textoQR) {
  if (!textoQR) return null;

  try {
    const obj = JSON.parse(textoQR);
    if (obj.id && obj.sender_id) {
      return {
        shipmentId: String(obj.id),
        sellerId: String(obj.sender_id),
      };
    }
  } catch { /* no es JSON */ }

  try {
    const url = new URL(textoQR);
    const paramId = url.searchParams.get('shipment_id') || url.searchParams.get('id');
    if (paramId) return { shipmentId: paramId, sellerId: null };
  } catch { /* no es URL */ }

  let bloqueMaximo = '';
  let bloqueActual = '';
  for (const char of String(textoQR)) {
    if (char >= '0' && char <= '9') {
      bloqueActual += char;
    } else {
      if (bloqueActual.length > bloqueMaximo.length) bloqueMaximo = bloqueActual;
      bloqueActual = '';
    }
  }
  if (bloqueActual.length > bloqueMaximo.length) bloqueMaximo = bloqueActual;

  if (bloqueMaximo.length >= 9) {
    return { shipmentId: bloqueMaximo, sellerId: null };
  }

  return null;
}

export async function obtenerDatosEnvio(shipmentId, sellerId) {
  if (!shipmentId) throw new Error('Shipment ID requerido');
  if (!sellerId) throw new Error('Seller ID requerido. Escaneá una etiqueta válida de ML.');

  const params = new URLSearchParams({ sellerId: String(sellerId) });
  const { envio } = await apiFetch(`/api/envios/${encodeURIComponent(shipmentId)}?${params}`);
  return envio;
}

export async function registrarVendedor(sellerId, refreshToken) {
  return apiFetch('/api/vendedores', {
    method: 'POST',
    body: JSON.stringify({
      sellerId: String(sellerId),
      refreshToken,
    }),
  });
}
