import { useState } from 'react';
import { apiFetch } from '../services/api';

const ESTADOS_SELLER = [
  { campo: 'enCamino', label: 'En camino', color: 'text-yellow-600' },
  { campo: 'entregados', label: 'Entregados', color: 'text-green-500' },
  { campo: 'demorados', label: 'Demorados', color: 'text-red-500' },
  { campo: 'reprogramados', label: 'Reprogramados', color: 'text-orange-500' },
  { campo: 'cancelados', label: 'Cancelados', color: 'text-gray-500' },
];

// Vista previa de un seller al tocarlo en la lista: mismo patrón de overlay
// que EscanerQR (fixed + backdrop), con la acción de eliminar al pie.
const DetalleSeller = ({ seller, onCerrar, onEliminado }) => {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const eliminar = async () => {
    setEliminando(true);
    setError('');
    try {
      await apiFetch(`/api/sellers?sellerId=${encodeURIComponent(seller.id)}`, { method: 'DELETE' });
      onEliminado(seller.id);
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
          <h3 className="text-lg font-bold text-gray-800">{seller.nombre}</h3>
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
            <span className="text-gray-500">Totales</span>
            <span className="font-semibold text-gray-800">{seller.totales}</span>
          </div>
          {ESTADOS_SELLER.map((col) => (
            <div key={col.campo} className="flex justify-between">
              <span className="text-gray-500">{col.label}</span>
              <span className={`font-medium ${col.color}`}>{seller[col.campo]}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t border-gray-100">
            <span className="text-gray-500">Monto facturado</span>
            <span className="font-bold text-green-600">${Number(seller.monto ?? 0).toLocaleString()}</span>
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
              Eliminar seller
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">¿Seguro que querés eliminar a "{seller.nombre}"?</p>
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

export default DetalleSeller;
