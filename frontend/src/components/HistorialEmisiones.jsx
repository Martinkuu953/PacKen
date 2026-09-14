import { formatearFecha, formatearMonto } from '../utils/formato';

// Los últimos documentos de las contrapartes elegidas (hasta 5 de cada una),
// cada uno con su descarga. El Excel se rearma desde el detalle guardado, así
// que un documento viejo sale igual que el día que se creó aunque después hayan
// cambiado las tarifas.
const HistorialEmisiones = ({
  config,
  historial,
  contrapartes = [],
  descargandoId,
  abriendoId,
  onVer,
  onDescargar,
  onVolver,
}) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
          Últimas {config.documentos}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {/* De quién es lo que se está mirando: con varios elegidos, la lista
              mezcla contrapartes y sin esto no se sabe cuál falta. */}
          {contrapartes.length ? contrapartes.join(', ') : `Sin ${config.contrapartes} elegidos`}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {historial.length === 0
            ? `Todavía no tienen ninguna ${config.documento}.`
            : `${historial.length} en total · hasta las últimas 5 de cada uno`}
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
      {historial.map((documento) => (
        <li
          key={documento.id}
          className="flex items-center gap-3 px-2 py-1 bg-white border border-gray-200 rounded-xl shadow-sm"
        >
          <button
            type="button"
            onClick={() => onVer(documento)}
            disabled={abriendoId === documento.id}
            className="min-w-0 flex-1 flex items-center gap-3 text-left px-2 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-gray-800 truncate">
                {documento.contraparte}
              </span>
              <span className="block text-xs text-gray-500">
                {abriendoId === documento.id
                  ? 'Abriendo...'
                  : `${formatearFecha(documento.desde)} al ${formatearFecha(documento.hasta)} · ${documento.cantidad} paquete${documento.cantidad === 1 ? '' : 's'} · ${formatearMonto(documento.total)}`}
              </span>
            </span>
            <span className="text-sm text-gray-600 whitespace-nowrap hidden sm:block">
              {formatearFecha(documento.creadaEn)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onDescargar(documento)}
            disabled={descargandoId === documento.id}
            aria-label={`Descargar ${config.documento} de ${documento.contraparte}`}
            className="shrink-0 w-9 h-9 mr-1 flex items-center justify-center bg-marca-oro text-marca-grafito rounded-full hover:bg-marca-oro-oscuro disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {descargandoId === documento.id ? '…' : '↓'}
          </button>
        </li>
      ))}
    </ul>
  </div>
);

export default HistorialEmisiones;
