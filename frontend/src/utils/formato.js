// Formatos compartidos por las pantallas de liquidaciones.

export function formatearMonto(valor) {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return '$0,00';
  return `$${numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatearFecha(valor) {
  if (!valor) return '—';

  // El "desde"/"hasta" de una liquidación es un DATE (YYYY-MM-DD, sin hora):
  // pasarlo por new Date() lo interpreta como UTC y lo corre un día para atrás.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (soloFecha) return `${soloFecha[3]}/${soloFecha[2]}/${soloFecha[1]}`;

  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-AR');
}
