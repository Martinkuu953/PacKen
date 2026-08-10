import { useMemo, useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { useCatalogos } from '../hooks/useCatalogos';
import { colorEstado, prioridadEstado } from '../utils/estados';
import { filtrarPorTexto } from '../utils/busqueda';
import { marcarEntregado, reasignarTransportista, simularEntregas } from '../services/paquetes';
import Buscador from '../components/Buscador';
import FiltrosPaquetes from '../components/FiltrosPaquetes';

const FILTROS_VACIOS = { sellerId: '', transportistaId: '', estado: '', desde: '', hasta: '' };

const COLUMNAS = [
  { campo: 'idenvioml', label: 'ID Envío ML' },
  { campo: 'comprador', label: 'Comprador' },
  { campo: 'direccion', label: 'Dirección' },
  { campo: 'codigopostal', label: 'CP' },
  { campo: 'zona', label: 'Zona' },
  { campo: 'seller', label: 'Seller' },
  { campo: 'fechaingreso', label: 'Ingreso' },
  { campo: 'estado', label: 'Estado' },
  { campo: 'transportista', label: 'Transportista' },
  { campo: 'acciones', label: '' },
];

const CAMPOS_BUSQUEDA = ['idenvioml', 'comprador', 'direccion', 'codigopostal', 'zona', 'seller'];

const formatearFecha = (iso) => {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-AR');
};

function compararPaquetes(a, b, campo, dir) {
  let resultado;
  if (campo === 'estado') {
    resultado = prioridadEstado(a.estado) - prioridadEstado(b.estado);
  } else if (campo === 'fechaingreso') {
    resultado = String(a.fechaingreso ?? '').localeCompare(String(b.fechaingreso ?? ''));
  } else {
    resultado = String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''));
  }
  return dir === 'asc' ? resultado : -resultado;
}

const PaquetesEmpresa = () => {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const { paquetes, loading, error, aviso, recargar } = usePaquetes(filtros);
  const { sellers, transportistas } = useCatalogos();

  const [orden, setOrden] = useState({ campo: 'estado', dir: 'asc' });
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const paquetesBuscados = useMemo(
    () => filtrarPorTexto(paquetes, busqueda, CAMPOS_BUSQUEDA),
    [paquetes, busqueda],
  );

  const paquetesOrdenados = useMemo(
    () => [...paquetesBuscados].sort((a, b) => compararPaquetes(a, b, orden.campo, orden.dir)),
    [paquetesBuscados, orden],
  );

  const cambiarOrden = (campo) => {
    if (campo === 'acciones') return;
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' },
    );
  };

  const flecha = (campo) => {
    if (orden.campo !== campo) return '';
    return orden.dir === 'asc' ? ' ▲' : ' ▼';
  };

  const ejecutar = async (id, accion) => {
    setOcupado(id);
    try {
      await accion();
      recargar();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setOcupado(null);
    }
  };

  const handleSimularTodas = async () => {
    setSimulando(true);
    try {
      const res = await simularEntregas();
      alert(`${res.actualizados} paquete(s) marcados como Entregado`);
      recargar();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSimulando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Paquetes</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSimularTodas}
              disabled={simulando}
              className="text-xs sm:text-sm px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors duration-150 font-medium"
            >
              {simulando ? 'Simulando...' : 'Entregar todos'}
            </button>
            <span className="text-xs sm:text-sm text-gray-500">
              {loading ? 'Cargando...' : `${paquetes.length} envíos`}
            </span>
          </div>
        </div>

        <FiltrosPaquetes
          valores={filtros}
          onChange={setFiltros}
          sellers={sellers}
          transportistas={transportistas}
        />

        {aviso && !error && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            {aviso}
          </p>
        )}
        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por ID de envío, comprador, dirección, CP, zona o seller..."
          resultados={paquetesBuscados.length}
          total={paquetes.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                {COLUMNAS.map((col) => (
                  <th
                    key={col.campo}
                    onClick={() => cambiarOrden(col.campo)}
                    className="py-2 px-1 sm:px-2 cursor-pointer select-none hover:text-gray-800 whitespace-nowrap"
                  >
                    {col.label}
                    {flecha(col.campo)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNAS.length} className="py-6 px-2 text-center text-gray-500">
                    Cargando paquetes...
                  </td>
                </tr>
              )}
              {!loading && paquetesOrdenados.length === 0 && !error && (
                <tr>
                  <td colSpan={COLUMNAS.length} className="py-6 px-2 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ningún paquete coincide con "${busqueda.trim()}".`
                      : 'No hay paquetes para los filtros seleccionados.'}
                  </td>
                </tr>
              )}
              {!loading &&
                paquetesOrdenados.map((paquete, index) => (
                  <tr
                    key={paquete.id ?? `${paquete.idenvioml}-${index}`}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-2 px-1 sm:px-2 font-mono truncate">{paquete.idenvioml}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-700">{paquete.comprador || '—'}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-600 truncate max-w-[14rem]">{paquete.direccion}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-600">{paquete.codigopostal || '—'}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-600">{paquete.zona || '—'}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-600">{paquete.seller || '—'}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-600 whitespace-nowrap">
                      {formatearFecha(paquete.fechaingreso)}
                    </td>
                    <td className={`py-2 px-1 sm:px-2 font-bold truncate ${colorEstado(paquete.estado)}`}>
                      {paquete.estado}
                    </td>
                    <td className="py-2 px-1 sm:px-2">
                      <select
                        value={paquete.transportistaId ?? ''}
                        disabled={ocupado === paquete.id}
                        onChange={(e) =>
                          ejecutar(paquete.id, () =>
                            reasignarTransportista(paquete.id, e.target.value || null),
                          )
                        }
                        className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white max-w-[10rem] disabled:opacity-50"
                      >
                        <option value="">Sin asignar</option>
                        {transportistas.map((t) => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-1 sm:px-2">
                      <button
                        onClick={() => ejecutar(paquete.id, () => marcarEntregado(paquete.id))}
                        disabled={ocupado === paquete.id}
                        className="text-xs px-2.5 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors duration-150 font-medium whitespace-nowrap"
                      >
                        {ocupado === paquete.id ? '...' : 'Entregar'}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaquetesEmpresa;
