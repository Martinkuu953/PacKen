import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from './Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

// Pantalla de listas (de precios o de costos): comparten exactamente la
// misma lógica y forma de datos contra /api/precios?tipo=..., solo cambia
// la entidad que se agrega como miembro (seller o transportista). Por eso
// es un único componente parametrizado en vez de dos páginas duplicadas.
//
//   tipo                 'precio' | 'costo'
//   tituloPagina          "Listas de precios" | "Listas de costos"
//   descripcion           texto de ayuda debajo del título
//   entidadLabel           "Seller" | "Transportista"
//   entidadLabelPlural     "sellers" | "transportistas"
//   campoMontoLabel        "Precio" | "Costo"

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all bg-white';

// Panel de detalle de la lista seleccionada: se monta con key={lista.id}
// desde el padre, así el estado del formulario (nombre, montos por zona)
// arranca de cero precargado con los datos de esa lista cada vez que se
// selecciona otra, sin necesitar un efecto que lo sincronice.
const PanelDetalle = ({
  lista,
  zonas,
  tipo,
  entidadLabel,
  entidadLabelPlural,
  campoMontoLabel,
  miembros,
  entidadesDisponibles,
  onGuardado,
  onError,
}) => {
  const [nombreEdit, setNombreEdit] = useState(lista.nombre);
  const [montosEdit, setMontosEdit] = useState(() => {
    const porZona = {};
    for (const z of zonas) {
      const m = lista.montos.find((mo) => mo.zonaId === z.id);
      porZona[z.id] = m ? String(m.monto) : '';
    }
    return porZona;
  });
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  const [miembroAAgregar, setMiembroAAgregar] = useState('');
  const [asignando, setAsignando] = useState(false);
  const [quitandoId, setQuitandoId] = useState(null);

  const handleGuardarEdit = async (e) => {
    e.preventDefault();
    setGuardandoEdit(true);
    try {
      const montos = Object.entries(montosEdit)
        .filter(([, valor]) => valor !== '' && valor !== undefined)
        .map(([zonaId, monto]) => ({ zonaId, monto }));

      await apiFetch('/api/precios', {
        method: 'POST',
        body: JSON.stringify({ tipo, accion: 'editar-lista', listaId: lista.id, nombre: nombreEdit, montos }),
      });
      await onGuardado();
    } catch (err) {
      onError(err.message);
    } finally {
      setGuardandoEdit(false);
    }
  };

  const handleAgregarMiembro = async (e) => {
    e.preventDefault();
    if (!miembroAAgregar) return;
    setAsignando(true);
    try {
      await apiFetch('/api/precios', {
        method: 'POST',
        body: JSON.stringify({ tipo, accion: 'asignar-miembro', listaId: lista.id, miembroId: miembroAAgregar }),
      });
      setMiembroAAgregar('');
      await onGuardado();
    } catch (err) {
      onError(err.message);
    } finally {
      setAsignando(false);
    }
  };

  const handleQuitarMiembro = async (miembroId) => {
    setQuitandoId(miembroId);
    try {
      await apiFetch('/api/precios', {
        method: 'POST',
        body: JSON.stringify({ tipo, accion: 'quitar-miembro', miembroId }),
      });
      await onGuardado();
    } catch (err) {
      onError(err.message);
    } finally {
      setQuitandoId(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <form onSubmit={handleGuardarEdit} className="space-y-3">
        <input
          type="text"
          value={nombreEdit}
          onChange={(e) => setNombreEdit(e.target.value)}
          required
          aria-label="Nombre de la lista"
          className={inputClass}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {zonas.map((z) => (
            <div key={z.id}>
              <label className="block text-xs text-gray-500 mb-1">
                {campoMontoLabel} {z.nombre}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={montosEdit[z.id] ?? ''}
                onChange={(e) => setMontosEdit({ ...montosEdit, [z.id]: e.target.value })}
                aria-label={`${campoMontoLabel} ${z.nombre}`}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={guardandoEdit}
          className="py-2 px-4 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150 text-sm"
        >
          {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      <div className="pt-3 border-t border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-2">{entidadLabelPlural}</p>

        <form onSubmit={handleAgregarMiembro} className="flex gap-2 mb-3">
          <select
            value={miembroAAgregar}
            onChange={(e) => setMiembroAAgregar(e.target.value)}
            aria-label={`Agregar ${entidadLabel}`}
            className={inputClass}
          >
            <option value="">Agregar {entidadLabel.toLowerCase()}...</option>
            {entidadesDisponibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
                {e.listaId ? ` — actualmente en: ${e.listaNombre}` : ''}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={asignando || !miembroAAgregar}
            className="shrink-0 py-2 px-4 bg-gray-800 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors duration-150 text-sm font-medium"
          >
            {asignando ? '...' : 'Agregar'}
          </button>
        </form>

        <div className="divide-y divide-gray-100">
          {miembros.length === 0 && (
            <p className="text-sm text-gray-500 py-2">Esta lista todavía no tiene {entidadLabelPlural}.</p>
          )}
          {miembros.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-800">{m.nombre}</span>
              <button
                type="button"
                onClick={() => handleQuitarMiembro(m.id)}
                disabled={quitandoId === m.id}
                className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors duration-150 font-medium"
              >
                {quitandoId === m.id ? '...' : 'Quitar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ListaGenerica = ({ tipo, tituloPagina, descripcion, entidadLabel, entidadLabelPlural, campoMontoLabel }) => {
  const [zonas, setZonas] = useState([]);
  const [listas, setListas] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadaId, setSeleccionadaId] = useState(null);

  const [nombreNueva, setNombreNueva] = useState('');
  const [montosNueva, setMontosNueva] = useState({});
  const [creando, setCreando] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);

  const endpoint = `/api/precios?tipo=${tipo}`;

  const aplicar = useCallback((res) => {
    setZonas(res.zonas ?? []);
    setListas(res.listas ?? []);
    setEntidades(res.entidades ?? []);
    setError('');
  }, []);

  const cargar = useCallback(async () => {
    try {
      aplicar(await apiFetch(endpoint));
    } catch (err) {
      setError(err.message);
    }
  }, [aplicar, endpoint]);

  useEffect(() => {
    let cancelado = false;
    apiFetch(endpoint)
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
  }, [endpoint, aplicar]);

  const encontradas = useMemo(() => filtrarPorTexto(listas, busqueda, ['nombre']), [listas, busqueda]);

  const seleccionada = useMemo(
    () => listas.find((l) => l.id === seleccionadaId) ?? null,
    [listas, seleccionadaId],
  );

  const miembrosPorLista = useMemo(() => {
    const mapa = new Map();
    for (const e of entidades) {
      if (!e.listaId) continue;
      if (!mapa.has(e.listaId)) mapa.set(e.listaId, []);
      mapa.get(e.listaId).push(e);
    }
    return mapa;
  }, [entidades]);

  const miembrosSeleccionada = seleccionada ? miembrosPorLista.get(seleccionada.id) ?? [] : [];
  const entidadesDisponibles = entidades.filter((e) => !seleccionada || e.listaId !== seleccionada.id);

  const handleCrear = async (e) => {
    e.preventDefault();
    setCreando(true);
    try {
      const montos = Object.entries(montosNueva)
        .filter(([, valor]) => valor !== '' && valor !== undefined)
        .map(([zonaId, monto]) => ({ zonaId, monto }));

      await apiFetch('/api/precios', {
        method: 'POST',
        body: JSON.stringify({ tipo, accion: 'crear-lista', nombre: nombreNueva, montos }),
      });
      setNombreNueva('');
      setMontosNueva({});
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const handleBorrar = async (listaId) => {
    setBorrandoId(listaId);
    try {
      await apiFetch(`/api/precios?tipo=${tipo}&id=${encodeURIComponent(listaId)}`, { method: 'DELETE' });
      if (seleccionadaId === listaId) setSeleccionadaId(null);
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrandoId(null);
    }
  };

  // Recarga desde el panel de detalle (guardar cambios, agregar/quitar
  // miembro): mismo `cargar` centralizado, con el mismo manejo de error.
  const recargarDesdeDetalle = async () => {
    try {
      aplicar(await apiFetch(endpoint));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">{tituloPagina}</h2>
        <p className="text-sm text-gray-500 mb-4">{descripcion}</p>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
        )}

        {!loading && entidades.length === 0 && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            No tenés {entidadLabelPlural} cargados todavía: sin {entidadLabelPlural} no se puede armar la lista.
          </p>
        )}

        <form onSubmit={handleCrear} className="mb-6 border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Crear lista</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
            <input
              type="text"
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              placeholder="Nombre de la lista"
              required
              aria-label="Nombre de la lista"
              className={`${inputClass} sm:col-span-2`}
            />
            {zonas.map((z) => (
              <input
                key={z.id}
                type="number"
                min="0"
                step="0.01"
                value={montosNueva[z.id] ?? ''}
                onChange={(e) => setMontosNueva({ ...montosNueva, [z.id]: e.target.value })}
                placeholder={`${campoMontoLabel} ${z.nombre}`}
                aria-label={`${campoMontoLabel} ${z.nombre}`}
                className={inputClass}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={creando}
            className="py-2 px-4 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150 text-sm"
          >
            {creando ? 'Creando...' : 'Crear lista'}
          </button>
        </form>

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar lista por nombre..."
          resultados={encontradas.length}
          total={listas.length}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
              {loading && <p className="p-4 text-sm text-gray-500 text-center">Cargando listas...</p>}
              {!loading && encontradas.length === 0 && (
                <p className="p-4 text-sm text-gray-500 text-center">
                  {busqueda.trim() ? `Ninguna lista coincide con "${busqueda.trim()}".` : 'Todavía no creaste ninguna lista.'}
                </p>
              )}
              {!loading &&
                encontradas.map((l) => {
                  const cantidad = miembrosPorLista.get(l.id)?.length ?? 0;
                  const activa = l.id === seleccionadaId;
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors duration-150 ${
                        activa ? 'bg-yellow-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSeleccionadaId(l.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{l.nombre}</p>
                        <p className="text-xs text-gray-500">
                          {cantidad} {entidadLabelPlural}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBorrar(l.id);
                        }}
                        disabled={borrandoId === l.id}
                        className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors duration-150 font-medium shrink-0 ml-2"
                      >
                        {borrandoId === l.id ? '...' : 'Borrar'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-3">
            {!seleccionada && (
              <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500 h-full flex items-center justify-center">
                Elegí una lista para ver y editar sus {campoMontoLabel.toLowerCase()}s y sus {entidadLabelPlural}.
              </div>
            )}

            {seleccionada && (
              <PanelDetalle
                key={seleccionada.id}
                lista={seleccionada}
                zonas={zonas}
                tipo={tipo}
                entidadLabel={entidadLabel}
                entidadLabelPlural={entidadLabelPlural}
                campoMontoLabel={campoMontoLabel}
                miembros={miembrosSeleccionada}
                entidadesDisponibles={entidadesDisponibles}
                onGuardado={recargarDesdeDetalle}
                onError={setError}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListaGenerica;
