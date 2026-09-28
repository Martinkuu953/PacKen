import { useState } from 'react';
import { apiFetch } from '../services/api';

const pesos = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

const formatearFechaHora = (iso) => {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? '—'
    : fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

function describir(h) {
  switch (h.accion) {
    case 'crear':
      return <>Se creó la lista <strong>{h.lista}</strong></>;
    case 'renombrar':
      return <>Se renombró <strong>{h.nombreAnterior}</strong> a <strong>{h.lista}</strong></>;
    case 'borrar':
      return <>Se borró la lista <strong>{h.lista}</strong></>;
    case 'tarifa':
      return (
        <>
          <strong>{h.lista}</strong> · {h.zona ?? 'zona borrada'}: {pesos(h.importeAnterior)} →{' '}
          <strong>{pesos(h.importeNuevo)}</strong>
        </>
      );
    default:
      return h.accion;
  }
}

// Historial de cambios de las listas del tipo actual. Plegado por defecto: se
// pide al servidor recién cuando se abre, y se vuelve a pedir en cada apertura.
const HistorialListas = ({ endpoint }) => {
  const [abierto, setAbierto] = useState(false);
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState('');

  const alternar = async () => {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setAbierto(true);
    setHistorial(null);
    setError('');
    try {
      const res = await apiFetch(`${endpoint}?historial=1`);
      setHistorial(res.historial ?? []);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <button
        type="button"
        onClick={alternar}
        className="text-sm font-semibold text-gray-700 hover:text-gray-900"
        aria-expanded={abierto}
      >
        {abierto ? '▼' : '▶'} Historial de cambios
      </button>

      {abierto && (
        <div className="mt-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && historial === null && <p className="text-sm text-gray-500">Cargando...</p>}
          {historial?.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no hay cambios registrados.</p>
          )}
          {historial?.length > 0 && (
            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto text-sm">
              {historial.map((h, i) => (
                <li key={i} className="py-2 flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                  <span className="text-gray-700">{describir(h)}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatearFechaHora(h.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default HistorialListas;
