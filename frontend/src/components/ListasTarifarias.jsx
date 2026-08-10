import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from './Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

// Pantalla única de tarifas con toggle Sellers / Transportistas.
//   - Sellers        → /api/precios (lo que se le cobra a cada seller)
//   - Transportistas → /api/costos  (lo que se le paga a cada transportista)
// Las listas tienen un importe por zona y se les asignan sellers/transportistas.
// El mapeo barrio→zona se hace en la pantalla "Establecer Zonas".

const CONFIG = {
  precio: {
    endpoint: '/api/precios',
    entidad: 'seller',
    entidades: 'Sellers',
    sinEntidades: 'No tenés sellers cargados todavía.',
  },
  costo: {
    endpoint: '/api/costos',
    entidad: 'transportista',
    entidades: 'Transportistas',
    sinEntidades: 'No tenés transportistas aceptados todavía.',
  },
};

const inputClass =
  'px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all bg-white';

const ListasTarifarias = () => {
  const [tipo, setTipo] = useState('precio');
  const cfg = CONFIG[tipo];

  const [listas, setListas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [expandida, setExpandida] = useState(null);
  const [nuevaLista, setNuevaLista] = useState('');
  const [busy, setBusy] = useState(false);

  // Borradores locales de tarifas por `${listaId}-${zonaId}` mientras se editan.
  const [tarifaDraft, setTarifaDraft] = useState({});
  // Panel "editar todas las zonas" abierto para una lista + sus valores.
  const [bulkAbierto, setBulkAbierto] = useState(null);
  const [bulkImporte, setBulkImporte] = useState('');
  const [bulkPct, setBulkPct] = useState('');
  // Renombrado inline.
  const [renombrando, setRenombrando] = useState(null);
  const [nombreEdit, setNombreEdit] = useState('');

  const cargar = useCallback(async (t) => {
    setLoading(true);
    try {
      const res = await apiFetch(CONFIG[t].endpoint);
      setListas(res.listas ?? []);
      setZonas(res.zonas ?? []);
      setEntidades(res.entidades ?? []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(tipo);
  }, [tipo, cargar]);

  const ejecutar = useCallback(
    async (body) => {
      setBusy(true);
      try {
        await apiFetch(CONFIG[tipo].endpoint, { method: 'POST', body: JSON.stringify(body) });
        await cargar(tipo);
        return true;
      } catch (err) {
        setError(err.message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [tipo, cargar],
  );

  const cambiarTipo = (nuevo) => {
    if (nuevo === tipo) return;
    setExpandida(null);
    setTarifaDraft({});
    setBulkAbierto(null);
    setRenombrando(null);
    setBusqueda('');
    setTipo(nuevo);
  };

  const listasFiltradas = useMemo(
    () => filtrarPorTexto(listas, busqueda, ['nombre']),
    [listas, busqueda],
  );

  const importeDe = (lista, zonaId) =>
    lista.tarifas?.find((t) => t.zonaId === zonaId)?.importe ?? 0;

  // ── Acciones ──────────────────────────────────────────────────────────────
  const crearLista = async () => {
    const nombre = nuevaLista.trim();
    if (!nombre) return;
    if (await ejecutar({ op: 'crearLista', nombre })) setNuevaLista('');
  };

  const borrarLista = async (id) => {
    if (!window.confirm(`¿Borrar esta lista? Los ${cfg.entidad}s asignados quedarán sin lista.`)) return;
    setBusy(true);
    try {
      await apiFetch(`${cfg.endpoint}?listaId=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (expandida === id) setExpandida(null);
      await cargar(tipo);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const guardarNombre = async (id) => {
    const nombre = nombreEdit.trim();
    if (nombre && (await ejecutar({ op: 'renombrarLista', listaId: id, nombre }))) {
      setRenombrando(null);
    }
  };

  const limpiarDraft = (key) =>
    setTarifaDraft((d) => {
      const resto = { ...d };
      delete resto[key];
      return resto;
    });

  const guardarTarifa = async (listaId, zonaId) => {
    const key = `${listaId}-${zonaId}`;
    const draft = tarifaDraft[key];
    if (draft === undefined) return;
    const lista = listas.find((l) => l.id === listaId);
    if (Number(draft) === Number(importeDe(lista, zonaId))) {
      limpiarDraft(key);
      return;
    }
    if (await ejecutar({ op: 'setTarifa', listaId, zonaId, importe: draft })) {
      limpiarDraft(key);
    }
  };

  const aplicarBulk = async (listaId, modo) => {
    const body = { op: 'setTarifasBulk', listaId };
    if (modo === 'importe') {
      if (bulkImporte === '') return;
      body.importe = bulkImporte;
    } else {
      if (bulkPct === '') return;
      body.porcentaje = bulkPct;
    }
    if (await ejecutar(body)) {
      setBulkAbierto(null);
      setBulkImporte('');
      setBulkPct('');
    }
  };

  const asignar = (entidadId, listaId) =>
    ejecutar({ op: 'asignarEntidad', entidadId, listaId: listaId || null });

  // ── Render ──────────────────────────────────────────────────────────────
  const toggleBtn = (valor, texto) => (
    <button
      type="button"
      onClick={() => cambiarTipo(valor)}
      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
        tipo === valor ? 'bg-white shadow-sm text-gray-800' : 'text-gray-600 hover:text-gray-800'
      }`}
    >
      {texto}
    </button>
  );

  const libres = entidades.filter((e) => !e.listaId);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Listas de precios y costos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Un importe por zona en cada lista; asignás {cfg.entidades.toLowerCase()} a la lista que
          corresponda.
        </p>

        {/* Toggle Sellers / Transportistas */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 max-w-sm">
          {toggleBtn('precio', 'Sellers')}
          {toggleBtn('costo', 'Transportistas')}
        </div>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Crear lista */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nuevaLista}
            onChange={(e) => setNuevaLista(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && crearLista()}
            placeholder="Nombre de la nueva lista..."
            aria-label="Nombre de la nueva lista"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            onClick={crearLista}
            disabled={busy || !nuevaLista.trim()}
            className="px-4 py-2 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors text-sm whitespace-nowrap"
          >
            + Crear lista
          </button>
        </div>

        {zonas.length === 0 && !loading && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            No tenés zonas todavía. Creá zonas y asigná barrios en <strong>Establecer zonas</strong>.
          </p>
        )}

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar lista por nombre..."
          resultados={listasFiltradas.length}
          total={listas.length}
        />

        {loading && <p className="py-6 text-center text-gray-500 text-sm">Cargando listas...</p>}

        {!loading && listasFiltradas.length === 0 && (
          <p className="py-6 text-center text-gray-500 text-sm">
            {busqueda.trim() ? `Ninguna lista coincide con "${busqueda.trim()}".` : 'Todavía no creaste ninguna lista.'}
          </p>
        )}

        <div className="space-y-3">
          {!loading &&
            listasFiltradas.map((lista) => {
              const abierta = expandida === lista.id;
              const asignadas = entidades.filter((e) => e.listaId === lista.id);
              return (
                <div key={lista.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Cabecera de la lista */}
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50">
                    {renombrando === lista.id ? (
                      <>
                        <input
                          type="text"
                          value={nombreEdit}
                          onChange={(e) => setNombreEdit(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && guardarNombre(lista.id)}
                          autoFocus
                          className={`${inputClass} flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() => guardarNombre(lista.id)}
                          disabled={busy}
                          className="text-xs px-2.5 py-1 bg-[#FDE047] text-gray-800 rounded-lg font-medium disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenombrando(null)}
                          className="text-xs px-2.5 py-1 bg-gray-200 text-gray-700 rounded-lg font-medium"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setExpandida(abierta ? null : lista.id)}
                          className="flex-1 min-w-0 flex items-center gap-2 text-left font-semibold text-gray-800"
                        >
                          <span className="text-gray-400 text-xs">{abierta ? '▼' : '▶'}</span>
                          {lista.nombre}
                          <span className="text-xs font-normal text-gray-500">
                            ({asignadas.length} {cfg.entidad}
                            {asignadas.length === 1 ? '' : 's'})
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenombrando(lista.id);
                            setNombreEdit(lista.nombre);
                          }}
                          className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          onClick={() => borrarLista(lista.id)}
                          disabled={busy}
                          className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium"
                          aria-label="Borrar lista"
                        >
                          – Borrar
                        </button>
                      </>
                    )}
                  </div>

                  {/* Detalle */}
                  {abierta && (
                    <div className="px-4 py-4 space-y-5">
                      {/* Tarifas por zona */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase">Precio por zona</h4>
                          <button
                            type="button"
                            onClick={() => setBulkAbierto(bulkAbierto === lista.id ? null : lista.id)}
                            className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                          >
                            Editar todas las zonas
                          </button>
                        </div>

                        {bulkAbierto === lista.id && (
                          <div className="mb-3 p-3 bg-gray-50 rounded-lg flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={bulkImporte}
                              onChange={(e) => setBulkImporte(e.target.value)}
                              placeholder="Poner todas en $"
                              className={`${inputClass} w-40`}
                            />
                            <button
                              type="button"
                              onClick={() => aplicarBulk(lista.id, 'importe')}
                              disabled={busy || bulkImporte === ''}
                              className="text-xs px-3 py-2 bg-[#FDE047] text-gray-800 rounded-lg font-medium disabled:opacity-50"
                            >
                              Aplicar
                            </button>
                            <span className="text-gray-300">|</span>
                            <input
                              type="number"
                              step="1"
                              value={bulkPct}
                              onChange={(e) => setBulkPct(e.target.value)}
                              placeholder="Ajustar %"
                              className={`${inputClass} w-32`}
                            />
                            <button
                              type="button"
                              onClick={() => aplicarBulk(lista.id, 'porcentaje')}
                              disabled={busy || bulkPct === ''}
                              className="text-xs px-3 py-2 bg-[#FDE047] text-gray-800 rounded-lg font-medium disabled:opacity-50"
                            >
                              Aplicar %
                            </button>
                          </div>
                        )}

                        {zonas.length === 0 ? (
                          <p className="text-sm text-gray-500">No hay zonas para tarifar.</p>
                        ) : (
                          <div className="space-y-2">
                            {zonas.map((z) => {
                              const key = `${lista.id}-${z.id}`;
                              const valor =
                                tarifaDraft[key] !== undefined
                                  ? tarifaDraft[key]
                                  : String(importeDe(lista, z.id));
                              return (
                                <div key={z.id} className="flex items-center gap-3">
                                  <span className="flex-1 text-sm text-gray-700">{z.nombre}</span>
                                  <span className="text-gray-400 text-sm">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={valor}
                                    onChange={(e) =>
                                      setTarifaDraft((d) => ({ ...d, [key]: e.target.value }))
                                    }
                                    onBlur={() => guardarTarifa(lista.id, z.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                    className={`${inputClass} w-32 text-right`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Entidades asignadas */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          {cfg.entidades} en esta lista
                        </h4>
                        {asignadas.length === 0 ? (
                          <p className="text-sm text-gray-500 mb-2">Ninguno asignado todavía.</p>
                        ) : (
                          <div className="space-y-2 mb-2">
                            {asignadas.map((e) => (
                              <div key={e.id} className="flex flex-wrap items-center gap-2">
                                <span className="flex-1 min-w-0 text-sm text-gray-800">{e.nombre}</span>
                                <select
                                  value=""
                                  onChange={(ev) => ev.target.value && asignar(e.id, ev.target.value)}
                                  disabled={busy}
                                  aria-label="Mover a otra lista"
                                  className={`${inputClass} text-xs py-1`}
                                >
                                  <option value="">Mover a...</option>
                                  {listas
                                    .filter((l) => l.id !== lista.id)
                                    .map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.nombre}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => asignar(e.id, null)}
                                  disabled={busy}
                                  className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 font-medium"
                                >
                                  Eliminar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Agregar entidad libre */}
                        {libres.length > 0 && (
                          <select
                            value=""
                            onChange={(ev) => ev.target.value && asignar(ev.target.value, lista.id)}
                            disabled={busy}
                            aria-label={`Agregar ${cfg.entidad}`}
                            className={`${inputClass} text-sm`}
                          >
                            <option value="">+ Agregar {cfg.entidad}...</option>
                            {libres.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.nombre}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {!loading && entidades.length === 0 && (
          <p className="mt-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            {cfg.sinEntidades}
          </p>
        )}
      </div>
    </div>
  );
};

export default ListasTarifarias;
