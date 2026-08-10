import { ESTADOS_VALIDOS } from '../utils/estados';

const SELECT = 'w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300';
const LABEL = 'block text-[11px] font-semibold text-gray-500 uppercase mb-1';

const FiltrosPaquetes = ({ valores, onChange, sellers = [], transportistas = [] }) => {
  const set = (campo) => (e) => onChange({ ...valores, [campo]: e.target.value });

  const hayFiltros = Object.values(valores).some(Boolean);

  return (
    <div className="mb-4 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

      {hayFiltros && (
        <button
          type="button"
          onClick={() => onChange({ sellerId: '', transportistaId: '', estado: '', desde: '', hasta: '' })}
          className="mt-3 text-xs text-gray-600 hover:text-gray-900 underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
};

export default FiltrosPaquetes;
