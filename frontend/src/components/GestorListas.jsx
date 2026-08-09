import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from './Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const moneda = (valor) =>
  `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all bg-white';

// Formulario de nombre + precio por zona, compartido entre "crear lista" y
// "editar precios": son exactamente los mismos campos.
function FormularioLista({ zonas, nombre, onNombreChange, preciosPorZona, onPrecioChange, onGuardar, onCancelar, guardando, textoBoton }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar();
      }}
      className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 mb-3"
    >
      <input
        type="text"
        value={nombre}
        onChange={(e) => onNombreChange(e.target.value)}
        placeholder="Nombre de la lista"
        required
        aria-label="Nombre de la lista"
        className={inputClass}
      />

      {zonas.length === 0 ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Todavía no hay zonas cargadas: la lista se puede crear igual, pero sin precios por zona.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {zonas.map((z) => (
            <label key={z.id} className="text-xs text-gray-600 space-y-1 block">
              <span className="block font-medium text-gray-700">{z.nombre}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={preciosPorZona[z.id] ?? ''}
                onChange={(e) => onPrecioChange(z.id, e.target.value)}
                placeholder="—"
                className={inputClass}
              />
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-150 font-medium"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={guardando}
          className="text-sm px-3 py-1.5 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150"
        >
          {guardando ? 'Guardando...' : textoBoton}
        </button>
      </div>
    </form>
  );
}

function preciosIniciales(lista) {
  const mapa = {};
  for (const p of lista?.precios ?? []) mapa[p.zonaId] = String(p.precio);
  return mapa;
}

function preciosParaEnviar(preciosPorZona) {
  return Object.entries(preciosPorZona)
    .filter(([, valor]) => valor !== '' && valor != null)
    .map(([zonaId, valor]) => ({ zonaId, precio: Number(valor) }));
}

// Componente compartido por "Listas de precios" (sellers) y "Listas de
// costos" (transportistas): mismo flujo, distinta entidad y tipo de lista.
const GestorListas = ({ tipo, titulo, descripcion, entidadSingular, entidadPlural }) => {
  const [listas, setListas] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [preciosNueva, setPreciosNueva] = useState({});
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [preciosEdicion, setPreciosEdicion] = useState({});
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [borrandoId, setBorrandoId] = useState(null);
  const [moviendoId, setMoviendoId] = useState(null);
  const [agregarSeleccion, setAgregarSeleccion] = useState({});

  const aplicar = useCallback((res) => {
    setListas(res.listas ?? []);
    setEntidades(res.entidades ?? []);
    setZonas(res.zonas ?? []);
    setError('');
  }, []);

  const cargar = useCallback(async () => {
    try {
      aplicar(await apiFetch(`/api/listas?tipo=${tipo}`));
    } catch (err) {
      setError(err.message);
    }
  }, [aplicar, tipo]);

  useEffect(() => {
    let cancelado = false;
    apiFetch(`/api/listas?tipo=${tipo}`)
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
  }, [aplicar, tipo]);

  const entidadesSinAsignar = useMemo(() => entidades.filter((e) => !e.listaId), [entidades]);

  // Busca por nombre de lista o de cualquiera de sus miembros.
  const listasBuscables = useMemo(
    () =>
      listas.map((l) => ({
        ...l,
        _busqueda: [l.nombre, ...l.miembros.map((m) => m.nombre)].join(' '),
      })),
    [listas],
  );
  const encontradas = useMemo(
    () => filtrarPorTexto(listasBuscables, busqueda, ['_busqueda']),
    [listasBuscables, busqueda],
  );

  const handleCrear = async () => {
    setGuardandoNueva(true);
    try {
      await apiFetch('/api/listas', {
        method: 'POST',
        body: JSON.stringify({ tipo, nombre: nombreNueva, precios: preciosParaEnviar(preciosNueva) }),
      });
      setCreando(false);
      setNombreNueva('');
      setPreciosNueva({});
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoNueva(false);
    }
  };

  const abrirEdicion = (lista) => {
    setEditandoId(lista.id);
    setNombreEdicion(lista.nombre);
    setPreciosEdicion(preciosIniciales(lista));
  };

  const handleGuardarEdicion = async () => {
    setGuardandoEdicion(true);
    try {
      await apiFetch('/api/listas', {
        method: 'PUT',
        body: JSON.stringify({
          tipo,
          id: editandoId,
          nombre: nombreEdicion,
          precios: preciosParaEnviar(preciosEdicion),
        }),
      });
      setEditandoId(null);
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const handleBorrar = async (id) => {
    setBorrandoId(id);
    try {
      await apiFetch(`/api/listas?tipo=${tipo}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrandoId(null);
    }
  };

  const handleAsignar = async (entidadId, listaId) => {
    setMoviendoId(entidadId);
    try {
      await apiFetch('/api/listas', {
        method: 'PATCH',
        body: JSON.stringify({ tipo, entidadId, listaId: listaId || null }),
      });
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setMoviendoId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{titulo}</h2>
          {!creando && (
            <button
              type="button"
              onClick={() => setCreando(true)}
              className="text-sm px-3 py-1.5 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 transition-colors duration-150 whitespace-nowrap"
            >
              + Nueva lista
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">{descripcion}</p>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
        )}

        {creando && (
          <FormularioLista
            zonas={zonas}
            nombre={nombreNueva}
            onNombreChange={setNombreNueva}
            preciosPorZona={preciosNueva}
            onPrecioChange={(zonaId, valor) => setPreciosNueva((p) => ({ ...p, [zonaId]: valor }))}
            onGuardar={handleCrear}
            onCancelar={() => {
              setCreando(false);
              setNombreNueva('');
              setPreciosNueva({});
            }}
            guardando={guardandoNueva}
            textoBoton="Crear lista"
          />
        )}

        {loading && <p className="text-center text-gray-500 py-6">Cargando listas...</p>}

        {!loading && listas.length === 0 && !creando && (
          <p className="text-center text-gray-500 py-6">Todavía no creaste ninguna lista.</p>
        )}

        {!loading && listas.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder={`Buscar por nombre de lista o ${entidadSingular}...`}
            resultados={encontradas.length}
            total={listas.length}
          />
        )}

        {!loading &&
          encontradas.map((lista) => {
            const disponiblesParaAgregar = entidadesSinAsignar;
            return (
              <div key={lista.id} className="border border-gray-200 rounded-xl p-4 mb-4 last:mb-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{lista.nombre}</h3>
                    <p className="text-xs text-gray-500">
                      {lista.miembros.length} {lista.miembros.length === 1 ? entidadSingular : entidadPlural}
                    </p>
                  </div>
                  {editandoId !== lista.id && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => abrirEdicion(lista)}
                        className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-150 font-medium"
                      >
                        Editar precios
                      </button>
                      <button
                        onClick={() => handleBorrar(lista.id)}
                        disabled={borrandoId === lista.id}
                        className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors duration-150 font-medium"
                      >
                        {borrandoId === lista.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  )}
                </div>

                {editandoId === lista.id ? (
                  <FormularioLista
                    zonas={zonas}
                    nombre={nombreEdicion}
                    onNombreChange={setNombreEdicion}
                    preciosPorZona={preciosEdicion}
                    onPrecioChange={(zonaId, valor) => setPreciosEdicion((p) => ({ ...p, [zonaId]: valor }))}
                    onGuardar={handleGuardarEdicion}
                    onCancelar={() => setEditandoId(null)}
                    guardando={guardandoEdicion}
                    textoBoton="Guardar cambios"
                  />
                ) : (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {lista.precios.length === 0 ? (
                      <span className="text-xs text-gray-400">Sin precios cargados</span>
                    ) : (
                      lista.precios.map((p) => (
                        <span
                          key={p.zonaId}
                          className="text-xs bg-gray-100 text-gray-700 rounded-lg px-2.5 py-1"
                        >
                          {p.zonaNombre}: <strong>{moneda(p.precio)}</strong>
                        </span>
                      ))
                    )}
                  </div>
                )}

                {lista.miembros.length > 0 && (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs sm:text-sm text-left">
                      <tbody>
                        {lista.miembros.map((m) => (
                          <tr key={m.id} className="border-t border-gray-100">
                            <td className="py-2 pr-2 text-gray-800">{m.nombre}</td>
                            <td className="py-2 pl-2 text-right">
                              <select
                                value={lista.id}
                                disabled={moviendoId === m.id}
                                onChange={(e) => handleAsignar(m.id, e.target.value)}
                                aria-label={`Mover o quitar a ${m.nombre}`}
                                className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white"
                              >
                                <option value="">Quitar de la lista</option>
                                {listas.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.id === lista.id ? `${l.nombre} (actual)` : `Mover a ${l.nombre}`}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {disponiblesParaAgregar.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      value={agregarSeleccion[lista.id] ?? ''}
                      onChange={(e) =>
                        setAgregarSeleccion((s) => ({ ...s, [lista.id]: e.target.value }))
                      }
                      aria-label={`Agregar ${entidadSingular} a ${lista.nombre}`}
                      className={`${inputClass} text-xs py-1.5`}
                    >
                      <option value="">Agregar {entidadSingular}...</option>
                      {disponiblesParaAgregar.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!agregarSeleccion[lista.id] || moviendoId === agregarSeleccion[lista.id]}
                      onClick={() => {
                        const entidadId = agregarSeleccion[lista.id];
                        handleAsignar(entidadId, lista.id);
                        setAgregarSeleccion((s) => ({ ...s, [lista.id]: '' }));
                      }}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors duration-150 font-medium whitespace-nowrap"
                    >
                      Agregar
                    </button>
                  </div>
                )}
              </div>
            );
          })}

        {!loading && entidadesSinAsignar.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {entidadesSinAsignar.length} {entidadesSinAsignar.length === 1 ? entidadSingular : entidadPlural} sin
            asignar a ninguna lista: {entidadesSinAsignar.map((e) => e.nombre).join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
};

export default GestorListas;
