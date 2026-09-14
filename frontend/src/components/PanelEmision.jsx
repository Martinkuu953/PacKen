import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiDescargar, apiFetch } from '../services/api';
import Buscador from './Buscador';
import PreviewEmision from './PreviewEmision';
import HistorialEmisiones from './HistorialEmisiones';
import { filtrarPorTexto } from '../utils/busqueda';

// Pantalla común de liquidaciones y facturas: se eligen contrapartes y un rango
// de fechas, se emiten los documentos del período y se descargan.
//
// Las dos son el mismo flujo con la contraparte cambiada —al transportista se
// le paga, al seller se le cobra—, así que lo único que las distingue es el
// `config` que baja desde la página (ver pages/Liquidaciones.jsx y
// pages/Facturas.jsx) y el endpoint que consulta.

const CAMPOS_BUSQUEDA = ['nombre'];

const INPUT_FECHA =
  'text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-marca-oro';

// El nombre de la contraparte puede traer espacios o acentos: los navegadores
// los aceptan, pero conviene un nombre de archivo parejo y sin barras.
const nombreArchivo = (config, documentos, separado) => {
  const base =
    documentos.length === 1
      ? `${config.archivo}-${documentos[0].contraparte}-${documentos[0].desde}_${documentos[0].hasta}`
      : `${config.archivos}-${documentos[0].desde}_${documentos[0].hasta}`;
  // El .zip solo tiene sentido con más de uno: uno solo siempre baja como
  // .xlsx, igual que decide el servidor.
  const extension = separado && documentos.length > 1 ? 'zip' : 'xlsx';
  return `${base.replace(/[^\w\-.]+/g, '-')}.${extension}`;
};

const PanelEmision = ({ config }) => {
  const [contrapartes, setContrapartes] = useState([]);
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

  const { endpoint } = config;

  useEffect(() => {
    let cancelado = false;
    apiFetch(endpoint)
      .then((res) => {
        if (!cancelado) setContrapartes(res.contrapartes ?? []);
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
  }, [endpoint]);

  const encontrados = useMemo(
    () => filtrarPorTexto(contrapartes, busqueda, CAMPOS_BUSQUEDA),
    [contrapartes, busqueda],
  );

  const alternar = (contraparte) => {
    if (!contraparte.lista) return;
    setSeleccionados((prev) => {
      const copia = new Set(prev);
      if (copia.has(contraparte.id)) copia.delete(contraparte.id);
      else copia.add(contraparte.id);
      return copia;
    });
  };

  const puedeCrear = seleccionados.size > 0 && desde !== '' && hasta !== '' && !creando;

  // `clave` es lo que se marca como "descargando" en la UI ('unico',
  // 'separado' o el id de un documento), y `separado` decide si el servidor
  // manda un Excel con todos o un .zip con uno por contraparte.
  const descargar = useCallback(
    async (documentos, clave, separado = false) => {
      setDescargandoId(clave);
      setError('');
      try {
        const ids = documentos.map((d) => d.id).join(',');
        const modo = separado && documentos.length > 1 ? '&modo=separado' : '';
        await apiDescargar(
          `${endpoint}?ids=${encodeURIComponent(ids)}${modo}`,
          nombreArchivo(config, documentos, separado),
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setDescargandoId(null);
      }
    },
    [config, endpoint],
  );

  // Las tres opciones de la vista previa: todo junto, uno por archivo, o solo
  // el de una contraparte (la clave es el id de su documento).
  const descargarPreview = (clave) => {
    const todos = preview?.documentos ?? [];
    if (clave === 'unico') return descargar(todos, 'unico');
    if (clave === 'separado') return descargar(todos, 'separado', true);

    const uno = todos.find((d) => d.id === clave);
    return uno ? descargar([uno], clave) : undefined;
  };

  // El historial se pide recién acá, y solo de las contrapartes elegidas: son
  // las últimas 5 de CADA una, así que sin elegir no hay nada que traer.
  const verHistorial = async () => {
    const elegidos = [...seleccionados];
    setCargandoHistorial(true);
    setError('');
    try {
      const res = await apiFetch(
        `${endpoint}?contraparteIds=${encodeURIComponent(elegidos.join(','))}`,
      );
      setHistorial(res.historial ?? []);
      setHistorialDe(contrapartes.filter((c) => elegidos.includes(c.id)).map((c) => c.nombre));
      setVista('historial');
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoHistorial(false);
    }
  };

  // Abre un documento ya emitido con el mismo detalle que sale en el Excel,
  // para poder mirarlo sin bajar el archivo.
  const verDetalle = async (documento) => {
    setAbriendoId(documento.id);
    setError('');
    try {
      const res = await apiFetch(`${endpoint}?ids=${encodeURIComponent(documento.id)}&formato=json`);
      setPreview({ documentos: res.documentos, sinPaquetes: [] });
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
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ contraparteIds: [...seleccionados], desde, hasta }),
      });
      // Sin descarga automática: primero se revisa la vista previa y el Excel
      // sale solo si se aprieta "Descargar". Si no, quedan archivos tirados por
      // cada documento que uno mira de paso.
      setPreview(res);
      setVolverA('seleccion');
      setVista('preview');
      // La selección se conserva: recién emitido es cuando más sirve poder
      // entrar al historial de esas mismas contrapartes.
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const mensajeError = error && (
    <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
      {error}
    </p>
  );

  if (vista === 'preview' && preview) {
    return (
      <div className="max-w-4xl mx-auto">
        {mensajeError}
        <PreviewEmision
          config={config}
          documentos={preview.documentos}
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
        {mensajeError}
        <HistorialEmisiones
          config={config}
          historial={historial}
          contrapartes={historialDe}
          descargandoId={descargandoId}
          abriendoId={abriendoId}
          onVer={verDetalle}
          onDescargar={(documento) => descargar([documento], documento.id)}
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
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{config.titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {/* Texto corto y de largo parejo: el anterior cambiaba de
                  singular a plural y en el celular pasaba de una linea a dos,
                  corriendo toda la lista de abajo. */}
              {loading ? 'Cargando...' : `${seleccionados.size} de ${contrapartes.length} seleccionados`}
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

        {mensajeError}

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1" htmlFor="emision-desde">
              Desde
            </label>
            <input
              id="emision-desde"
              type="date"
              className={INPUT_FECHA}
              value={desde}
              max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1" htmlFor="emision-hasta">
              Hasta
            </label>
            <input
              id="emision-hasta"
              type="date"
              className={INPUT_FECHA}
              value={hasta}
              min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500 pb-2">
            {config.textoRango} los paquetes <span className="font-medium">entregados</span> en ese rango.
          </p>
        </div>

        {!loading && contrapartes.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder={`Buscar ${config.contraparte} por nombre...`}
            resultados={encontrados.length}
            total={contrapartes.length}
          />
        )}

        {loading && (
          <p className="py-6 text-center text-gray-500 text-sm">Cargando {config.contrapartes}...</p>
        )}

        {!loading && encontrados.length === 0 && (
          <p className="py-6 text-center text-gray-500 text-sm">
            {busqueda.trim()
              ? `Ningún ${config.contraparte} coincide con "${busqueda.trim()}".`
              : config.vacio}
          </p>
        )}

        <ul className="space-y-3">
          {encontrados.map((contraparte) => {
            const activo = seleccionados.has(contraparte.id);
            const emitible = Boolean(contraparte.lista);

            return (
              <li key={contraparte.id}>
                <button
                  type="button"
                  onClick={() => alternar(contraparte)}
                  disabled={!emitible}
                  aria-pressed={activo}
                  className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl text-left transition-colors duration-150 ${
                    activo
                      ? 'bg-marca-amarillo border-marca-oro shadow-sm'
                      : emitible
                        ? 'bg-white border-gray-200 shadow-sm hover:bg-gray-50'
                        : 'bg-gray-50 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  <span className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold">
                    {contraparte.nombre.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold truncate ${emitible ? 'text-gray-800' : 'text-gray-400'}`}>
                      {contraparte.nombre}
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {emitible ? `Lista: ${contraparte.lista}` : config.sinLista}
                    </span>
                  </span>
                  {!emitible && (
                    <span className="shrink-0 text-[10px] uppercase font-semibold text-gray-500 bg-gray-200 rounded-full px-2 py-1">
                      {config.noEmitible}
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
            {creando ? 'Creando...' : `Crear ${config.documento}`}
          </button>
          <button
            type="button"
            onClick={verHistorial}
            disabled={seleccionados.size === 0 || cargandoHistorial}
            className="px-6 py-2.5 bg-marca-oro text-marca-grafito rounded-xl font-semibold hover:bg-marca-oro-oscuro disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {cargandoHistorial ? 'Buscando...' : `Ver últimas ${config.documentos}`}
          </button>
        </div>

        {/* La ayuda siempre ocupa su lugar aunque este vacia, para que aparecer
            y desaparecer no mueva los botones de arriba. */}
        <p className="mt-3 min-h-4 text-center text-xs text-gray-500">
          {seleccionados.size === 0
            ? `Elegí uno o más ${config.contrapartes} para crear una ${config.documento} o ver las anteriores.`
            : !desde || !hasta
              ? `Elegí un rango de fechas para poder crear la ${config.documento}.`
              : ''}
        </p>
      </div>
    </div>
  );
};

export default PanelEmision;
