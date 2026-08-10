import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const CAMPOS_BUSQUEDA = ['transportistaNombre', 'zonaNombre'];

const FORM_VACIO = { transportistaId: '', zonaId: '', costo: '' };

const moneda = (valor) =>
  `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ListasCostos = () => {
  const [costos, setCostos] = useState([]);
  const [transportistas, setTransportistas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(null);

  const aplicar = useCallback((res) => {
    setCostos(res.costos ?? []);
    setTransportistas(res.transportistas ?? []);
    setZonas(res.zonas ?? []);
    setError('');
  }, []);

  // Recarga manual (después de guardar o borrar).
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      aplicar(await apiFetch('/api/costos'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [aplicar]);

  // Carga inicial. Va aparte de cargar() para no tocar el estado de forma
  // síncrona dentro del efecto, y para poder cancelarla si el componente se
  // desmonta antes de que responda la API.
  useEffect(() => {
    let cancelado = false;
    apiFetch('/api/costos')
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
    () => filtrarPorTexto(costos, busqueda, CAMPOS_BUSQUEDA),
    [costos, busqueda],
  );

  const totales = useMemo(
    () => encontrados.reduce((acc, c) => acc + c.costo, 0),
    [encontrados],
  );

  const editar = (costo) => {
    setForm({
      transportistaId: costo.transportistaId ?? '',
      zonaId: costo.zonaId ?? '',
      costo: String(costo.costo),
    });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await apiFetch('/api/costos', { method: 'POST', body: JSON.stringify(form) });
      setForm(FORM_VACIO);
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleBorrar = async (id) => {
    setBorrando(id);
    try {
      await apiFetch(`/api/costos?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setError('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrando(null);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all bg-white';

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Listas de costos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tarifa por transportista y zona: el <strong>costo</strong> es lo que le pagás al
          transportista.
        </p>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleGuardar} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <select
            value={form.transportistaId}
            onChange={(e) => setForm({ ...form, transportistaId: e.target.value })}
            required
            aria-label="Transportista"
            className={inputClass}
          >
            <option value="">Transportista...</option>
            {transportistas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <select
            value={form.zonaId}
            onChange={(e) => setForm({ ...form, zonaId: e.target.value })}
            required
            aria-label="Zona"
            className={inputClass}
          >
            <option value="">Zona...</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
                {z.cpDesde != null && z.cpHasta != null ? ` (${z.cpDesde}–${z.cpHasta})` : ''}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            value={form.costo}
            onChange={(e) => setForm({ ...form, costo: e.target.value })}
            placeholder="Costo"
            required
            aria-label="Costo"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={guardando || transportistas.length === 0 || zonas.length === 0}
            className="py-2 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150 text-sm"
          >
            {guardando ? 'Guardando...' : 'Guardar tarifa'}
          </button>
        </form>

        {!loading && transportistas.length === 0 && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            No tenés transportistas aceptados todavía: sin transportistas no se puede armar la
            lista.
          </p>
        )}

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por transportista o zona..."
          resultados={encontrados.length}
          total={costos.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">Transportista</th>
                <th className="py-2 px-2">Zona</th>
                <th className="py-2 px-2 text-right">Costo</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-6 px-2 text-center text-gray-500">
                    Cargando tarifas...
                  </td>
                </tr>
              )}
              {!loading && encontrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-2 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ninguna tarifa coincide con "${busqueda.trim()}".`
                      : 'Todavía no cargaste ninguna tarifa.'}
                  </td>
                </tr>
              )}
              {!loading &&
                encontrados.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-800">{c.transportistaNombre}</td>
                    <td className="py-2 px-2 text-gray-600">{c.zonaNombre}</td>
                    <td className="py-2 px-2 text-right text-gray-800">{moneda(c.costo)}</td>
                    <td className="py-2 px-2">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => editar(c)}
                          className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-150 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleBorrar(c.id)}
                          disabled={borrando === c.id}
                          className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors duration-150 font-medium"
                        >
                          {borrando === c.id ? '...' : 'Borrar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
            {!loading && encontrados.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold text-gray-700">
                  <td className="py-2 px-2" colSpan={2}>
                    Totales ({encontrados.length})
                  </td>
                  <td className="py-2 px-2 text-right">{moneda(totales)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListasCostos;
