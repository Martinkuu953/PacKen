import { useEffect, useState } from 'react';
import { getHistorialPaquete } from '../services/paquetes';
import { colorEstado } from '../utils/estados';

const ORIGENES = {
  manual: 'Cambio manual',
  entrega_masiva: 'Entrega de seleccionados',
  escaneo_colecta: 'Escaneo de colecta',
  escaneo_reparto: 'Escaneo de reparto',
  webhook_ml: 'Aviso de Mercado Libre',
  sync_ml: 'Sincronización con Mercado Libre',
};

const formatearFechaHora = (iso) => {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? '—'
    : fecha.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
};

// Modal con la línea de tiempo de estados de un paquete.
const HistorialPaquete = ({ paquete, onCerrar }) => {
  const [historial, setHistorial] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    getHistorialPaquete(paquete.id)
      .then((h) => !cancelado && setHistorial(h))
      .catch((err) => !cancelado && setError(err.message));
    return () => {
      cancelado = true;
    };
  }, [paquete.id]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-historial"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 id="titulo-historial" className="text-lg font-bold text-gray-800">Historial de estados</h3>
            <p className="text-xs text-gray-500 font-mono">{paquete.idenvioml}</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-2xl leading-none text-gray-400 hover:text-gray-700">
            ×
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && historial === null && <p className="text-sm text-gray-500">Cargando...</p>}
        {historial?.length === 0 && (
          <p className="text-sm text-gray-500">
            Todavía no hay cambios registrados para este paquete. El historial empieza a
            guardarse desde que se activó esta función.
          </p>
        )}

        {historial?.length > 0 && (
          <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
            {historial.map((h, i) => (
              <li key={i} className="ml-4">
                <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-marca-amarillo border-2 border-white" />
                <p className="text-sm">
                  {h.de ? (
                    <>
                      <span className={colorEstado(h.de)}>{h.de}</span>
                      <span className="text-gray-400"> → </span>
                    </>
                  ) : (
                    <span className="text-gray-500">Alta: </span>
                  )}
                  <span className={`font-semibold ${colorEstado(h.a)}`}>{h.a}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {formatearFechaHora(h.fecha)}
                  {' · '}
                  {ORIGENES[h.origen] ?? 'Cambio externo'}
                  {h.usuario ? ` · ${h.usuario}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default HistorialPaquete;
