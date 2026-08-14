import { useState } from 'react';
import { apiFetch } from '../services/api';

const formatearFecha = (iso) => {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-AR');
};

// Vista previa de un transportista al tocarlo en la lista: mismo patrón de
// overlay que DetalleSeller, con la acción de eliminar al pie.
const DetalleTransportista = ({ transportista, onCerrar, onEliminado }) => {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const eliminar = async () => {
    setEliminando(true);
    setError('');
    try {
      await apiFetch(`/api/transportistas?transportistaId=${encodeURIComponent(transportista.id)}`, {
        method: 'DELETE',
      });
      onEliminado(transportista.id);
    } catch (err) {
      setError(err.message);
      setEliminando(false);
      setConfirmando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-gray-800">{transportista.nombre}</h3>
          <button
            onClick={onCerrar}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="space-y-1 text-sm mb-2">
          <div className="flex justify-between">
            <span className="text-gray-500">DNI</span>
            <span className="font-semibold text-gray-800">{transportista.dni || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Alta</span>
            <span className="font-medium text-gray-800">{formatearFecha(transportista.created_at)}</span>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-5 pt-4 border-t border-gray-200">
          {!confirmando ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="w-full text-sm px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-150 font-medium"
            >
              Eliminar transportista
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                ¿Seguro que querés eliminar a "{transportista.nombre}"?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={eliminar}
                  disabled={eliminando}
                  className="flex-1 text-sm px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={eliminando}
                  className="flex-1 text-sm px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetalleTransportista;
