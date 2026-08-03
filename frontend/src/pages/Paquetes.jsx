import { useMemo, useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { colorEstado, prioridadEstado } from '../utils/estados';
import { filtrarPorTexto } from '../utils/busqueda';
import { marcarEntregado, simularEntregas } from '../services/paquetes';
import Buscador from '../components/Buscador';
import EscanerQR from '../components/EscanerQR';

const VISTAS = { SELECCION: null, COLECTA: 'colecta', REPARTO: 'reparto' };

const ESTADO_POR_VISTA = {
  colecta: 'Ingresado',
  reparto: 'En camino',
};

const COLUMNAS = [
  { campo: 'idenvioml', label: 'ID Envío ML' },
  { campo: 'comprador', label: 'Comprador' },
  { campo: 'direccion', label: 'Dirección' },
  { campo: 'codigopostal', label: 'CP' },
  { campo: 'estado', label: 'Estado', importante: true },
];

const CAMPOS_BUSQUEDA = ['idenvioml', 'comprador', 'direccion', 'codigopostal', 'estado'];

function compararPaquetes(a, b, campo, dir) {
  let resultado;
  if (campo === 'estado') {
    resultado = prioridadEstado(a.estado) - prioridadEstado(b.estado);
  } else {
    resultado = String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''));
  }
  return dir === 'asc' ? resultado : -resultado;
}

const PantallaSeleccion = ({ paquetes, onEscanear, onVerListado }) => {
  const totalColecta = paquetes.filter((p) => p.estado === ESTADO_POR_VISTA.colecta).length;
  const totalReparto = paquetes.filter((p) => p.estado === ESTADO_POR_VISTA.reparto).length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 sm:mb-8">Paquetes</h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
          <button
            onClick={() => onEscanear(VISTAS.COLECTA)}
            className="flex-1 py-4 sm:py-6 text-lg sm:text-xl font-semibold text-gray-800 bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-150 shadow-sm"
          >
            Colecta
          </button>
          <button
            onClick={() => onEscanear(VISTAS.REPARTO)}
            className="flex-1 py-4 sm:py-6 text-lg sm:text-xl font-semibold text-gray-800 bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-150 shadow-sm"
          >
            Reparto
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => onVerListado(VISTAS.REPARTO)}
            className="flex-1 p-4 sm:p-5 text-left bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-150 shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-700 leading-tight mb-1">
              Listado<br />Reparto
            </p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-500">{totalReparto}</p>
          </button>
          <button
            onClick={() => onVerListado(VISTAS.COLECTA)}
            className="flex-1 p-4 sm:p-5 text-left bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-150 shadow-sm"
          >
            <p className="text-sm font-semibold text-gray-700 leading-tight mb-1">
              Listado<br />Colecta
            </p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-500">{totalColecta}</p>
          </button>
        </div>
      </div>
    </div>
  );
};

const TablaPaquetes = ({ paquetes, loading, error, aviso, vista, onVolver, onRecargar }) => {
  const [orden, setOrden] = useState({ campo: 'estado', dir: 'asc' });
  const [busqueda, setBusqueda] = useState('');
  const [entregando, setEntregando] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const esReparto = vista === VISTAS.REPARTO;
  const estadoFiltro = ESTADO_POR_VISTA[vista];
  const titulo = vista === VISTAS.COLECTA ? 'Listado Colecta' : 'Listado Reparto';

  const columnas = esReparto
    ? [...COLUMNAS, { campo: 'acciones', label: '', importante: false }]
    : COLUMNAS;

  const paquetesFiltrados = useMemo(
    () => paquetes.filter((p) => p.estado === estadoFiltro),
    [paquetes, estadoFiltro],
  );

  const paquetesBuscados = useMemo(
    () => filtrarPorTexto(paquetesFiltrados, busqueda, CAMPOS_BUSQUEDA),
    [paquetesFiltrados, busqueda],
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

  const handleEntregar = async (id) => {
    setEntregando(id);
    try {
      await marcarEntregado(id);
      onRecargar();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setEntregando(null);
    }
  };

  const handleSimularTodas = async () => {
    setSimulando(true);
    try {
      const res = await simularEntregas();
      alert(`${res.actualizados} paquete(s) marcados como Entregado`);
      onRecargar();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSimulando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onVolver}
              className="text-gray-400 hover:text-gray-700 transition-colors duration-150 text-lg font-bold"
              aria-label="Volver"
            >
              ←
            </button>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">{titulo}</h2>
          </div>
          <div className="flex items-center gap-3">
            {esReparto && paquetesFiltrados.length > 0 && (
              <button
                onClick={handleSimularTodas}
                disabled={simulando}
                className="text-xs sm:text-sm px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors duration-150 font-medium"
              >
                {simulando ? 'Simulando...' : 'Entregar todos'}
              </button>
            )}
            <span className="text-xs sm:text-sm text-gray-500">
              {loading ? 'Cargando...' : `${paquetesFiltrados.length} envíos`}
            </span>
          </div>
        </div>

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
          placeholder="Buscar por ID de envío, comprador, dirección o CP..."
          resultados={paquetesBuscados.length}
          total={paquetesFiltrados.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                {columnas.map((col) => (
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
                  <td colSpan={columnas.length} className="py-6 px-2 text-center text-gray-500">
                    Cargando paquetes...
                  </td>
                </tr>
              )}
              {!loading && paquetesOrdenados.length === 0 && !error && (
                <tr>
                  <td colSpan={columnas.length} className="py-6 px-2 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ningún paquete coincide con "${busqueda.trim()}".`
                      : 'No hay paquetes en este listado.'}
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
                    <td className="py-2 px-1 sm:px-2 text-gray-600 truncate">{paquete.direccion}</td>
                    <td className="py-2 px-1 sm:px-2 text-gray-600">{paquete.codigopostal || '—'}</td>
                    <td className={`py-2 px-1 sm:px-2 font-bold truncate ${colorEstado(paquete.estado)}`}>
                      {paquete.estado}
                    </td>
                    {esReparto && (
                      <td className="py-2 px-1 sm:px-2">
                        <button
                          onClick={() => handleEntregar(paquete.id)}
                          disabled={entregando === paquete.id}
                          className="text-xs px-2.5 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors duration-150 font-medium whitespace-nowrap"
                        >
                          {entregando === paquete.id ? '...' : 'Entregar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Paquetes = () => {
  const { paquetes, loading, error, aviso, recargar } = usePaquetes();
  const [vista, setVista] = useState(VISTAS.SELECCION);
  const [tipoEscaneo, setTipoEscaneo] = useState(null);

  const cerrarEscaner = () => {
    setTipoEscaneo(null);
  };

  const onPaqueteGuardado = (paquete) => {
    recargar();
    if (paquete?.estado === 'Ingresado') {
      setVista(VISTAS.COLECTA);
    } else if (paquete?.estado === 'En camino') {
      setVista(VISTAS.REPARTO);
    }
  };

  if (tipoEscaneo) {
    return (
      <EscanerQR
        tipo={tipoEscaneo}
        onCerrar={cerrarEscaner}
        onPaqueteGuardado={onPaqueteGuardado}
      />
    );
  }

  if (vista === VISTAS.SELECCION) {
    return (
      <PantallaSeleccion
        paquetes={paquetes}
        onEscanear={setTipoEscaneo}
        onVerListado={setVista}
      />
    );
  }

  return (
    <TablaPaquetes
      paquetes={paquetes}
      loading={loading}
      error={error}
      aviso={aviso}
      vista={vista}
      onVolver={() => setVista(VISTAS.SELECCION)}
      onRecargar={recargar}
    />
  );
};

export default Paquetes;
