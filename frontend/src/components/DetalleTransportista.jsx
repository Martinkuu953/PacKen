import { useState } from 'react';
import { apiFetch } from '../services/api';

const formatearFecha = (iso) => {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-AR');
};

// Sin caracteres ambiguos (0/O, 1/l/I): esta contraseña se dicta por teléfono o
// se copia a mano de un papel, así que la confusión sale cara.
const ALFABETO = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarPassword(largo = 12) {
  const valores = crypto.getRandomValues(new Uint32Array(largo));
  return Array.from(valores, (n) => ALFABETO[n % ALFABETO.length]).join('');
}

// Vista previa de un transportista al tocarlo en la lista: mismo patrón de
// overlay que DetalleSeller, con las acciones al pie.
const DetalleTransportista = ({ transportista, onCerrar, onEliminado }) => {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  const [reseteando, setReseteando] = useState(false);
  const [passwordNueva, setPasswordNueva] = useState('');
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [passwordAplicada, setPasswordAplicada] = useState('');
  const [copiado, setCopiado] = useState(false);

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

  const restablecer = async (e) => {
    e.preventDefault();
    setGuardandoPassword(true);
    setError('');
    try {
      await apiFetch(`/api/transportistas?transportistaId=${encodeURIComponent(transportista.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: passwordNueva }),
      });
      // Se muestra una sola vez, acá: el servidor guarda un hash y no hay forma
      // de volver a leerla después de cerrar este cartel.
      setPasswordAplicada(passwordNueva);
      setPasswordNueva('');
      setReseteando(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoPassword(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(passwordAplicada);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles queda a la vista para copiarla a mano.
      setCopiado(false);
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

        {passwordAplicada && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-800 uppercase mb-1">Contraseña nueva</p>
            <p className="font-mono text-base text-gray-900 break-all">{passwordAplicada}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={copiar}
                className="text-xs px-2 py-1 bg-white border border-green-300 text-green-800 rounded hover:bg-green-100 font-medium"
              >
                {copiado ? 'Copiada' : 'Copiar'}
              </button>
              <span className="text-xs text-green-800">
                Pasásela ahora: al cerrar esto no se puede volver a ver.
              </span>
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-200 space-y-2">
          {reseteando ? (
            <form onSubmit={restablecer} className="space-y-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase" htmlFor="reset-password">
                Contraseña nueva
              </label>
              <div className="flex gap-2">
                <input
                  id="reset-password"
                  type="text"
                  className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-marca-oro"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setPasswordNueva(generarPassword())}
                  className="text-xs px-2 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium whitespace-nowrap"
                >
                  Generar
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Se cierra la sesión del transportista. Decile que la cambie desde Mi Perfil cuando entre.
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={guardandoPassword}
                  className="flex-1 text-sm px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium"
                >
                  {guardandoPassword ? 'Guardando...' : 'Restablecer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReseteando(false);
                    setPasswordNueva('');
                  }}
                  disabled={guardandoPassword}
                  className="flex-1 text-sm px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            !confirmando && (
              <button
                type="button"
                onClick={() => {
                  setReseteando(true);
                  setPasswordAplicada('');
                  setCopiado(false);
                }}
                className="w-full text-sm px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150 font-medium"
              >
                Restablecer contraseña
              </button>
            )
          )}

          {!confirmando ? (
            !reseteando && (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="w-full text-sm px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors duration-150 font-medium"
              >
                Eliminar transportista
              </button>
            )
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
