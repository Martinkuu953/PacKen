import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDescargar, apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import PreviewLiquidacion from '../components/PreviewLiquidacion';
import HistorialLiquidaciones from '../components/HistorialLiquidaciones';
import { filtrarPorTexto } from '../utils/busqueda';

const ENDPOINT = '/api/liquidaciones';
const CAMPOS_BUSQUEDA = ['nombre'];

const INPUT_FECHA =
  'text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300';

// El nombre del transportista puede traer espacios o acentos: los navegadores
// los aceptan, pero conviene un nombre de archivo parejo y sin barras.
const nombreArchivo = (liquidaciones) => {
  const base =
    liquidaciones.length === 1
      ? `liquidacion-${liquidaciones[0].transportista}-${liquidaciones[0].desde}_${liquidaciones[0].hasta}`
      : `liquidaciones-${liquidaciones[0].desde}_${liquidaciones[0].hasta}`;
  return `${base.replace(/[^\w\-.]+/g, '-')}.xlsx`;
};

const Liquidaciones = () => {
  const [transportistas, setTransportistas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [seleccionados, setSeleccionados] = useState(() => new Set());
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [vista, setVista] = useState('seleccion');
  const [preview, setPreview] = useState(null);
  // A dónde vuelve la vista previa: se llega a ella tanto al crear como al
  // abrir una del historial, y el botón "Volver" tiene que deshacer el camino
  // que se hizo.
  const [volverA, setVolverA] = useState('seleccion');
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [descargandoId, setDescargandoId] = useState(null);
  const [abriendoId, setAbriendoId] = useState(null);
  const [error, setError] = useState('');

  const aplicar = useCallback((res) => {
    setTransportistas(res.transportistas ?? []);
    setHistorial(res.historial ?? []);
  }, []);

  useEffect(() => {
    let cancelado = false;
    apiFetch(ENDPOINT)
      .then((res) => {
        if (!cancelado) aplicar(res);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aplicar]);

  const encontrados = useMemo(
    () => filtrarPorTexto(transportistas, busqueda, CAMPOS_BUSQUEDA),
    [transportistas, busqueda],
  );

  const alternar = (transportista) => {
    if (!transportista.lista) return;
    setSeleccionados((prev) => {
      const copia = new Set(prev);
      if (copia.has(transportista.id)) copia.delete(transportista.id);
      else copia.add(transportista.id);
      return copia;
    });
  };

  const puedeCrear = seleccionados.size > 0 && desde !== '' && hasta !== '' && !creando;

  const descargar = useCallback(async (liquidaciones, id) => {
    setDescargandoId(id);
    setError('');
    try {
      const ids = liquidaciones.map((l) => l.id).join(',');
      await apiDescargar(`${ENDPOINT}?ids=${encodeURIComponent(ids)}`, nombreArchivo(liquidaciones));
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargandoId(null);
    }
  }, []);

  // Abre una liquidación ya emitida con el mismo detalle que sale en el Excel,
  // para poder mirarla sin bajar el archivo.
  const verDetalle = async (liquidacion) => {
    setAbriendoId(liquidacion.id);
    setError('');
    try {
      const res = await apiFetch(`${ENDPOINT}?ids=${encodeURIComponent(liquidacion.id)}&formato=json`);
      setPreview({ liquidaciones: res.liquidaciones, sinPaquetes: [] });
      setVolverA('historial');
      setVista('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setAbriendoId(null);
    }
  };

  const crear = async () => {
    setCreando(true);
    setError('');
    try {
      const res = await apiFetch(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ transportistaIds: [...seleccionados], desde, hasta }),
      });
      setPreview(res);
      setVolverA('seleccion');
      setVista('preview');
      setSeleccionados(new Set());
      // Sin descarga automática: primero se revisa la vista previa y el Excel
      // sale solo si se aprieta "Descargar". Si no, quedan archivos tirados por
      // cada liquidación que uno mira de paso.
      apiFetch(ENDPOINT).then(aplicar).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  if (vista === 'preview' && preview) {
    return (
      <div className="max-w-4xl mx-auto">
        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
        <PreviewLiquidacion
          liquidaciones={preview.liquidaciones}
          sinPaquetes={preview.sinPaquetes}
          recienCreada={volverA === 'seleccion'}
          descargando={descargandoId === 'preview'}
          onDescargar={() => descargar(preview.liquidaciones, 'preview')}
          onVolver={() => setVista(volverA)}
        />
      </div>
    );
  }

  if (vista === 'historial') {
    return (
      <div className="max-w-4xl mx-auto">
        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
        <HistorialLiquidaciones
          historial={historial}
          descargandoId={descargandoId}
          abriendoId={abriendoId}
          onVer={verDetalle}
          onDescargar={(liquidacion) => descargar([liquidacion], liquidacion.id)}
          onVolver={() => setVista('seleccion')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Liquidaciones</h2>
            <p className="text-sm text-gray-500 mt-1">
              {loading
                ? 'Cargando...'
                : `${seleccionados.size} de ${transportistas.length} transportista${transportistas.length === 1 ? '' : 's'} seleccionado${seleccionados.size === 1 ? '' : 's'}`}
            </p>
          </div>
          {seleccionados.size > 0 && (
            <button
              type="button"
              onClick={() => setSeleccionados(new Set())}
              className="text-xs sm:text-sm px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 transition-colors duration-150 font-medium"
            >
              Deseleccionar
            </button>
          )}
        </div>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1" htmlFor="liq-desde">
              Desde
            </label>
            <input
              id="liq-desde"
              type="date"
              className={INPUT_FECHA}
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1" htmlFor="liq-hasta">
              Hasta
            </label>
            <input
              id="liq-hasta"
              type="date"
              className={INPUT_FECHA}
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500 pb-2">
            Se liquidan los paquetes <span className="font-medium">entregados</span> en ese rango.
          </p>
        </div>

        {!loading && transportistas.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar transportista por nombre..."
            resultados={encontrados.length}
            total={transportistas.length}
          />
        )}

        {loading && <p className="py-6 text-center text-gray-500 text-sm">Cargando transportistas...</p>}

        {!loading && encontrados.length === 0 && (
          <p className="py-6 text-center text-gray-500 text-sm">
            {busqueda.trim()
              ? `Ningún transportista coincide con "${busqueda.trim()}".`
              : 'Todavía no creaste ningún transportista.'}
          </p>
        )}

        <ul className="space-y-3">
          {encontrados.map((transportista) => {
            const activo = seleccionados.has(transportista.id);
            const liquidable = Boolean(transportista.lista);

            return (
              <li key={transportista.id}>
                <button
                  type="button"
                  onClick={() => alternar(transportista)}
                  disabled={!liquidable}
                  aria-pressed={activo}
                  className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl text-left transition-colors duration-150 ${
                    activo
                      ? 'bg-[#FDE047] border-yellow-400 shadow-sm'
                      : liquidable
                        ? 'bg-white border-gray-200 shadow-sm hover:bg-gray-50'
                        : 'bg-gray-50 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <span className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold">
                    {transportista.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold truncate ${liquidable ? 'text-gray-800' : 'text-gray-400'}`}>
                      {transportista.nombre}
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {liquidable ? `Lista: ${transportista.lista}` : 'Sin lista de costos asignada'}
                    </span>
                  </span>
                  {!liquidable && (
                    <span className="shrink-0 text-[10px] uppercase font-semibold text-gray-500 bg-gray-200 rounded-full px-2 py-1">
                      No liquidable
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={crear}
            disabled={!puedeCrear}
            className="px-6 py-2.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {creando ? 'Creando...' : 'Crear liquidación'}
          </button>
          <button
            type="button"
            onClick={() => setVista('historial')}
            className="px-6 py-2.5 bg-[#FDE047] text-gray-800 rounded-xl font-semibold hover:bg-yellow-300 transition-colors duration-150"
          >
            Ver últimas liquidaciones
          </button>
        </div>

        {seleccionados.size > 0 && (!desde || !hasta) && (
          <p className="mt-3 text-center text-xs text-gray-500">
            Elegí un rango de fechas para poder crear la liquidación.
          </p>
        )}
      </div>
    </div>
  );
};

export default Liquidaciones;
