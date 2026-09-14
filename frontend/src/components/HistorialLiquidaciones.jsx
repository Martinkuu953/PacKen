import { formatearFecha, formatearMonto } from '../utils/formato';

// Las últimas liquidaciones emitidas, cada una con su descarga. El Excel se
// rearma desde el detalle guardado, así que una liquidación vieja sale igual
// que el día que se creó aunque después hayan cambiado las tarifas.
const HistorialLiquidaciones = ({ historial, descargandoId, onDescargar, onVolver }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Últimas liquidaciones</h2>
        <p className="text-sm text-gray-500 mt-1">
          {historial.length === 0 ? 'Todavía no generaste ninguna.' : `Las últimas ${historial.length}`}
        </p>
      </div>
      <button
        type="button"
        onClick={onVolver}
        className="text-xs sm:text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150 font-medium"
      >
        Volver
      </button>
    </div>

    <ul className="space-y-3">
      {historial.map((liquidacion) => (
        <li
          key={liquidacion.id}
          className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 truncate">{liquidacion.transportista}</p>
            <p className="text-xs text-gray-500">
              {formatearFecha(liquidacion.desde)} al {formatearFecha(liquidacion.hasta)} ·{' '}
              {liquidacion.cantidad} paquete{liquidacion.cantidad === 1 ? '' : 's'} ·{' '}
              {formatearMonto(liquidacion.total)}
            </p>
          </div>

          <span className="text-sm text-gray-600 whitespace-nowrap hidden sm:block">
            {formatearFecha(liquidacion.creadaEn)}
          </span>

          <button
            type="button"
            onClick={() => onDescargar(liquidacion)}
            disabled={descargandoId === liquidacion.id}
            aria-label={`Descargar liquidación de ${liquidacion.transportista}`}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-[#FDE047] rounded-full hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {descargandoId === liquidacion.id ? '…' : '↓'}
          </button>
        </li>
      ))}
    </ul>
  </div>
);

export default HistorialLiquidaciones;
