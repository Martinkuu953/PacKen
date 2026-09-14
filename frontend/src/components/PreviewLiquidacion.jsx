import { formatearFecha, formatearMonto } from '../utils/formato';

// Vista previa de las liquidaciones recién creadas, con el mismo detalle que
// sale en el Excel. Una sección por transportista.
const PreviewLiquidacion = ({
  liquidaciones,
  sinPaquetes = [],
  recienCreada = false,
  descargando,
  onDescargar,
  onVolver,
}) => {
  const totalGeneral = liquidaciones.reduce((suma, l) => suma + l.total, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Liquidaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            {liquidaciones.length === 1
              ? `${liquidaciones[0].transportista} · ${formatearFecha(liquidaciones[0].desde)} al ${formatearFecha(liquidaciones[0].hasta)}`
              : `${liquidaciones.length} transportistas · ${formatearFecha(liquidaciones[0].desde)} al ${formatearFecha(liquidaciones[0].hasta)}`}
          </p>
          {recienCreada && (
            <p className="text-xs text-gray-400 mt-0.5">
              Ya quedó guardada: podés descargar el Excel ahora o más tarde, desde "Ver últimas liquidaciones".
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onVolver}
          className="text-xs sm:text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150 font-medium"
        >
          Volver
        </button>
      </div>

      {sinPaquetes.length > 0 && (
        <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          Sin paquetes entregados en el período (no se les generó liquidación): {sinPaquetes.join(', ')}.
        </p>
      )}

      {liquidaciones.map((liquidacion) => (
        <section key={liquidacion.id} className="mb-6 last:mb-0">
          {liquidaciones.length > 1 && (
            <h3 className="text-sm font-bold text-gray-700 mb-2">{liquidacion.transportista}</h3>
          )}

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="text-[10px] sm:text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3">Dirección</th>
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Seller</th>
                  <th className="py-2 px-3">Zona</th>
                  <th className="py-2 px-3 text-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                {liquidacion.lineas.map((linea, i) => (
                  <tr key={`${liquidacion.id}-${i}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-3 text-gray-800">{linea.direccion || '—'}</td>
                    <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                      {formatearFecha(linea.fechaentrega)}
                    </td>
                    <td className="py-2 px-3 text-gray-600">{linea.seller || '—'}</td>
                    <td className="py-2 px-3 text-gray-600">{linea.zona || '—'}</td>
                    <td className="py-2 px-3 text-gray-800 text-right whitespace-nowrap">
                      {formatearMonto(linea.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-2 px-4 py-2 bg-marca-amarillo rounded-xl">
            <span className="text-sm font-bold text-gray-800">
              Total ({liquidacion.cantidad} paquete{liquidacion.cantidad === 1 ? '' : 's'})
            </span>
            <span className="text-sm font-bold text-gray-800">{formatearMonto(liquidacion.total)}</span>
          </div>
        </section>
      ))}

      {liquidaciones.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 mt-4 pt-4">
          <span className="text-sm font-bold text-gray-800">Total general</span>
          <span className="text-sm font-bold text-gray-800">{formatearMonto(totalGeneral)}</span>
        </div>
      )}

      <div className="flex justify-center mt-6">
        <button
          type="button"
          onClick={onDescargar}
          disabled={descargando}
          className="px-8 py-2.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
        >
          {descargando ? 'Descargando...' : 'Descargar'}
        </button>
      </div>
    </div>
  );
};

export default PreviewLiquidacion;
