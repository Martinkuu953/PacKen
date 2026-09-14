import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

// "Establecer Zonas": la zona POR DEFECTO de cada barrio/municipio que trae
// Mercado Flex, para toda la empresa. Cada lista de precios/costos puede
// definir la suya para los barrios que haya negociado distinto (ver
// MapeoBarriosLista); lo que no defina, cae acá.
//
// Se guarda al instante. Los barrios se pueblan al escanear paquetes y/o con
// "Sincronizar barrios de Flex".
// Usa /api/precios porque zonas y áreas son de la empresa, no de una lista.

const ENDPOINT = '/api/precios';

const inputClass =
  'px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-marca-oro focus:border-transparent transition-all bg-white';

const EstablecerZonas = () => {
  const [zonas, setZonas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busy, setBusy] = useState(false);
  const [nuevaZona, setNuevaZona] = useState('');
  const [editZona, setEditZona] = useState(null);
  const [nombreZona, setNombreZona] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(ENDPOINT);
      setZonas(res.zonas ?? []);
      setAreas(res.areas ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const areasFiltradas = useMemo(
    () => filtrarPorTexto(areas, busqueda, ['nombre']),
    [areas, busqueda],
  );

  const post = async (body) => {
    await apiFetch(ENDPOINT, { method: 'POST', body: JSON.stringify(body) });
  };

  // Asignación con actualización optimista (la pantalla dice "se guarda auto").
  const asignarArea = async (areaId, zonaId) => {
    const previo = areas;
    setAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, zonaId } : a)));
    try {
      await post({ op: 'asignarArea', areaId, zonaId: zonaId || null });
    } catch (err) {
      setError(err.message);
      setAreas(previo);
    }
  };

  const sincronizar = async () => {
    setBusy(true);
    setError('');
    setAviso('');
    try {
      const res = await post({ op: 'sincronizarAreasFlex' });
      await cargar();
      setAviso(res?.cantidad ? `Sincronizado desde Flex (${res.cantidad} barrios).` : 'Sincronizado desde Flex.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const crearZona = async () => {
    const nombre = nuevaZona.trim();
    if (!nombre) return;
    setBusy(true);
    try {
      await post({ op: 'crearZona', nombre });
      setNuevaZona('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const guardarNombreZona = async (id) => {
    const nombre = nombreZona.trim();
    if (!nombre) return;
    setBusy(true);
    try {
      await post({ op: 'renombrarZona', zonaId: id, nombre });
      setEditZona(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const borrarZona = async (id) => {
    if (!window.confirm('¿Borrar esta zona? Los barrios asignados quedarán sin zona.')) return;
    setBusy(true);
    try {
      await post({ op: 'borrarZona', zonaId: id });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center">Establecer Zonas</h2>
        <p className="text-xs text-gray-500 text-center mt-1">
          Zona por defecto de cada barrio/municipio para toda la empresa.
        </p>
        <p className="text-xs text-gray-400 text-center mb-4">
          Cada lista de precios/costos puede pisar esto para los barrios que haya negociado
          distinto. (Se guarda automáticamente)
        </p>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
        {aviso && (
          <p className="mb-4 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            {aviso}
          </p>
        )}

        {/* Gestión de zonas */}
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">Zonas</h4>
            <button
              type="button"
              onClick={sincronizar}
              disabled={busy}
              className="text-xs px-3 py-1.5 bg-marca-oro text-marca-grafito rounded-lg hover:bg-marca-oro-oscuro disabled:opacity-50 font-medium"
            >
              {busy ? '...' : 'Sincronizar barrios de Flex'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {zonas.map((z, i) =>
              editZona === z.id ? (
                <span key={z.id} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={nombreZona}
                    onChange={(e) => setNombreZona(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && guardarNombreZona(z.id)}
                    autoFocus
                    className={`${inputClass} w-28 py-1`}
                  />
                  <button
                    type="button"
                    onClick={() => guardarNombreZona(z.id)}
                    className="text-xs px-2 py-1 bg-marca-oro text-marca-grafito rounded-lg font-medium"
                  >
                    OK
                  </button>
                </span>
              ) : (
                <span
                  key={z.id}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-700"
                >
                  <span className="text-gray-400 text-xs font-bold">{z.orden ?? i + 1}</span>
                  {z.nombre}
                  <button
                    type="button"
                    onClick={() => {
                      setEditZona(z.id);
                      setNombreZona(z.nombre);
                    }}
                    className="text-gray-400 hover:text-gray-700 ml-1"
                    aria-label="Renombrar zona"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => borrarZona(z.id)}
                    className="text-red-400 hover:text-red-600"
                    aria-label="Borrar zona"
                  >
                    ×
                  </button>
                </span>
              ),
            )}
            <span className="flex items-center gap-1">
              <input
                type="text"
                value={nuevaZona}
                onChange={(e) => setNuevaZona(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && crearZona()}
                placeholder="Nueva zona"
                className={`${inputClass} w-28 py-1`}
              />
              <button
                type="button"
                onClick={crearZona}
                disabled={busy || !nuevaZona.trim()}
                className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50"
              >
                +
              </button>
            </span>
          </div>
        </div>

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar barrio/municipio..."
          resultados={areasFiltradas.length}
          total={areas.length}
        />

        {loading && <p className="py-6 text-center text-gray-500 text-sm">Cargando barrios...</p>}

        {!loading && areas.length === 0 && (
          <p className="py-6 text-center text-gray-500 text-sm">
            Todavía no hay barrios. Sincronizá desde Flex o escaneá paquetes para que aparezcan.
          </p>
        )}

        {!loading && areas.length > 0 && zonas.length === 0 && (
          <p className="py-4 text-center text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4">
            Creá al menos una zona para poder asignar los barrios.
          </p>
        )}

        <div className="divide-y divide-gray-100">
          {!loading &&
            areasFiltradas.map((area) => (
              <div key={area.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{area.nombre}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {zonas.map((z, i) => {
                    const activa = area.zonaId === z.id;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        title={z.nombre}
                        onClick={() => asignarArea(area.id, activa ? null : z.id)}
                        className={`w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                          activa
                            ? 'bg-marca-amarillo text-marca-grafito shadow-sm'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                      >
                        {z.orden ?? i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default EstablecerZonas;
