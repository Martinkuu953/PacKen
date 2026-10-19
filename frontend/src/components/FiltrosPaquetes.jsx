import { ESTADOS_VALIDOS } from '../utils/estados';

const SELECT = 'w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-marca-oro';
const LABEL = 'block text-[11px] font-semibold text-gray-500 uppercase mb-1';

const FILTROS_VACIOS = { sellerId: '', transportistaId: '', estado: '', desde: '', hasta: '' };

// Con onAplicar los cambios no se aplican solos: aparece el botón "Buscar
// paquetes" y recién ahí se consulta (lo usa Paquetes, donde el volumen es
// alto). Sin onAplicar, cada cambio filtra en el momento (Estadísticas).
const FiltrosPaquetes = ({ valores, onChange, onAplicar, onLimpiar, sellers = [], transportistas = [] }) => {
  const set = (campo) => (e) => onChange({ ...valores, [campo]: e.target.value });

  const hayFiltros = Object.values(valores).some(Boolean);

  const limpiar = () => {
    onChange(FILTROS_VACIOS);
    onLimpiar?.();
  };

  const aplicar = (e) => {
    e.preventDefault();
    if (hayFiltros) onAplicar?.();
  };

  return (
    <form onSubmit={aplicar} className="mb-4 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className={LABEL} htmlFor="filtro-seller">Seller</label>
          <select id="filtro-seller" className={SELECT} value={valores.sellerId} onChange={set('sellerId')}>
            <option value="">Todos</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="filtro-transportista">Transportista</label>
          <select
            id="filtro-transportista"
            className={SELECT}
            value={valores.transportistaId}
            onChange={set('transportistaId')}
          >
            <option value="">Todos</option>
            {transportistas.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="filtro-estado">Estado</label>
          <select id="filtro-estado" className={SELECT} value={valores.estado} onChange={set('estado')}>
            <option value="">Todos</option>
            {ESTADOS_VALIDOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="filtro-desde">Desde</label>
          <input id="filtro-desde" type="date" className={SELECT} value={valores.desde} onChange={set('desde')} />
        </div>

        <div>
          <label className={LABEL} htmlFor="filtro-hasta">Hasta</label>
          <input id="filtro-hasta" type="date" className={SELECT} value={valores.hasta} onChange={set('hasta')} />
        </div>
      </div>

      {(onAplicar || hayFiltros) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {onAplicar && (
            <button
              type="submit"
              disabled={!hayFiltros}
              className="text-sm px-4 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors duration-150 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buscar paquetes
            </button>
          )}
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiar}
              className="text-xs text-gray-600 hover:text-gray-900 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </form>
  );
};

export default FiltrosPaquetes;
