import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDescargar, apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import PreviewLiquidacion from '../components/PreviewLiquidacion';
import HistorialLiquidaciones from '../components/HistorialLiquidaciones';
import { filtrarPorTexto } from '../utils/busqueda';

const ENDPOINT = '/api/liquidaciones';
const CAMPOS_BUSQUEDA = ['nombre'];

const INPUT_FECHA =
  'text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-marca-oro';

// El nombre del transportista puede traer espacios o acentos: los navegadores
// los aceptan, pero conviene un nombre de archivo parejo y sin barras.
const nombreArchivo = (liquidaciones, separado) => {
  const base =
    liquidaciones.length === 1
      ? `liquidacion-${liquidaciones[0].transportista}-${liquidaciones[0].desde}_${liquidaciones[0].hasta}`
      : `liquidaciones-${liquidaciones[0].desde}_${liquidaciones[0].hasta}`;
  // El .zip solo tiene sentido con más de una: una sola siempre baja como .xlsx,
  // igual que decide el servidor.
  const extension = separado && liquidaciones.length > 1 ? 'zip' : 'xlsx';
  return `${base.replace(/[^\w\-.]+/g, '-')}.${extension}`;
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
  // De quiénes es el historial que se está mirando: se congela al entrar, para
  // que el encabezado no cambie si después se toca la selección.
  const [historialDe, setHistorialDe] = useState([]);
  // A dónde vuelve la vista previa: se llega a ella tanto al crear como al
  // abrir una del historial, y el botón "Volver" tiene que deshacer el camino
  // que se hizo.
  const [volverA, setVolverA] = useState('seleccion');
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [descargandoId, setDescargandoId] = useState(null);
  const [abriendoId, setAbriendoId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    apiFetch(ENDPOINT)
      .then((res) => {
        if (!cancelado) setTransportistas(res.transportistas ?? []);
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
  }, []);

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

  // `clave` es lo que se marca como "descargando" en la UI ('unico',
  // 'separado' o el id de una liquidación), y `separado` decide si el servidor
  // manda un Excel con todas o un .zip con una por transportista.
  const descargar = useCallback(async (liquidaciones, clave, separado = false) => {
    setDescargandoId(clave);
    setError('');
    try {
      const ids = liquidaciones.map((l) => l.id).join(',');
      const modo = separado && liquidaciones.length > 1 ? '&modo=separado' : '';
      await apiDescargar(
        `${ENDPOINT}?ids=${encodeURIComponent(ids)}${modo}`,
        nombreArchivo(liquidaciones, separado),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargandoId(null);
    }
  }, []);

  // Las tres opciones de la vista previa: todo junto, una por archivo, o solo
  // la de un transportista (la clave es su id de liquidación).
  const descargarPreview = (clave) => {
    const todas = preview?.liquidaciones ?? [];
    if (clave === 'unico') return descargar(todas, 'unico');
    if (clave === 'separado') return descargar(todas, 'separado', true);

    const una = todas.find((l) => l.id === clave);
    return una ? descargar([una], clave) : undefined;
  };

  // El historial se pide recién acá, y solo de los transportistas elegidos: son
  // las últimas 5 de CADA uno, así que sin elegir no hay nada que traer.
  const verHistorial = async () => {
    const elegidos = [...seleccionados];
    setCargandoHistorial(true);
    setError('');
    try {
      const res = await apiFetch(`${ENDPOINT}?transportistaIds=${encodeURIComponent(elegidos.join(','))}`);
      setHistorial(res.historial ?? []);
      setHistorialDe(
        transportistas.filter((t) => elegidos.includes(t.id)).map((t) => t.nombre),
      );
      setVista('historial');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoHistorial(false);
    }
  };

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
      // Sin descarga automática: primero se revisa la vista previa y el Excel
      // sale solo si se aprieta "Descargar". Si no, quedan archivos tirados por
      // cada liquidación que uno mira de paso.
      setPreview(res);
      setVolverA('seleccion');
      setVista('preview');
      // La selección se conserva: recién liquidado es cuando más sirve poder
      // entrar al historial de esos mismos transportistas.
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
          descargando={descargandoId}
          onDescargar={descargarPreview}
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
          transportistas={historialDe}
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
        {/* Nada de montar y desmontar segun la seleccion: en el celular cada
            aparicion empujaba la lista y el dedo terminaba tocando otra fila.
            "Deseleccionar" siempre esta, deshabilitado cuando no hay nada. */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Liquidaciones</h2>
            <p className="text-sm text-gray-500 mt-1">
              {/* Texto corto y de largo parejo: el anterior cambiaba de
                  singular a plural y en el celular pasaba de una linea a dos,
                  corriendo toda la lista de abajo. */}
              {loading ? 'Cargando...' : `${seleccionados.size} de ${transportistas.length} seleccionados`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSeleccionados(new Set())}
            disabled={seleccionados.size === 0}
            className={`shrink-0 text-xs sm:text-sm px-3 py-1.5 rounded-lg border transition-colors duration-150 font-medium ${
              seleccionados.size === 0
                ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                : 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
            }`}
          >
            Deseleccionar
          </button>
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
                      ? 'bg-marca-amarillo border-marca-oro shadow-sm'
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
            onClick={verHistorial}
            disabled={seleccionados.size === 0 || cargandoHistorial}
            className="px-6 py-2.5 bg-marca-oro text-marca-grafito rounded-xl font-semibold hover:bg-marca-oro-oscuro disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {cargandoHistorial ? 'Buscando...' : 'Ver últimas liquidaciones'}
          </button>
        </div>

        {/* La ayuda siempre ocupa su lugar aunque este vacia, para que aparecer
            y desaparecer no mueva los botones de arriba. */}
        <p className="mt-3 min-h-4 text-center text-xs text-gray-500">
          {seleccionados.size === 0
            ? 'Elegí uno o más transportistas para crear una liquidación o ver las anteriores.'
            : !desde || !hasta
              ? 'Elegí un rango de fechas para poder crear la liquidación.'
              : ''}
        </p>
      </div>
    </div>
  );
};

export default Liquidaciones;
