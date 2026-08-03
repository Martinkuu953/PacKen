import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const CAMPOS_BUSQUEDA = ['sellerNombre', 'zonaNombre'];

const FORM_VACIO = { sellerId: '', zonaId: '', costo: '', precio: '' };

const moneda = (valor) =>
  `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ListasPrecios = () => {
  const [precios, setPrecios] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(null);

  const aplicar = useCallback((res) => {
    setPrecios(res.precios ?? []);
    setSellers(res.sellers ?? []);
    setZonas(res.zonas ?? []);
    setError('');
  }, []);

  // Recarga manual (después de guardar o borrar).
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      aplicar(await apiFetch('/api/precios'));
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
    apiFetch('/api/precios')
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
    () => filtrarPorTexto(precios, busqueda, CAMPOS_BUSQUEDA),
    [precios, busqueda],
  );

  // El margen no se guarda: sale siempre de costo y precio, así no puede
  // quedar desincronizado.
  const totales = useMemo(
    () =>
      encontrados.reduce(
        (acc, p) => ({
          costo: acc.costo + p.costo,
          precio: acc.precio + p.precio,
        }),
        { costo: 0, precio: 0 },
      ),
    [encontrados],
  );

  const editar = (precio) => {
    setForm({
      sellerId: precio.sellerId ?? '',
      zonaId: precio.zonaId ?? '',
      costo: String(precio.costo),
      precio: String(precio.precio),
    });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await apiFetch('/api/precios', { method: 'POST', body: JSON.stringify(form) });
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
      await apiFetch(`/api/precios?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Listas de precios</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tarifa por seller y zona. El <strong>costo</strong> es lo que le pagás al transportista;
          el <strong>precio</strong>, lo que le cobrás al seller.
        </p>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleGuardar} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6">
          <select
            value={form.sellerId}
            onChange={(e) => setForm({ ...form, sellerId: e.target.value })}
            required
            aria-label="Seller"
            className={inputClass}
          >
            <option value="">Seller...</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
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

          <input
            type="number"
            min="0"
            step="0.01"
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: e.target.value })}
            placeholder="Precio"
            required
            aria-label="Precio"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={guardando || sellers.length === 0 || zonas.length === 0}
            className="py-2 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150 text-sm"
          >
            {guardando ? 'Guardando...' : 'Guardar tarifa'}
          </button>
        </form>

        {!loading && sellers.length === 0 && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            No tenés sellers cargados todavía: sin sellers no se puede armar la lista.
          </p>
        )}

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por seller o zona..."
          resultados={encontrados.length}
          total={precios.length}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">Seller</th>
                <th className="py-2 px-2">Zona</th>
                <th className="py-2 px-2 text-right">Costo</th>
                <th className="py-2 px-2 text-right">Precio</th>
                <th className="py-2 px-2 text-right">Margen</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="py-6 px-2 text-center text-gray-500">
                    Cargando tarifas...
                  </td>
                </tr>
              )}
              {!loading && encontrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-2 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ninguna tarifa coincide con "${busqueda.trim()}".`
                      : 'Todavía no cargaste ninguna tarifa.'}
                  </td>
                </tr>
              )}
              {!loading &&
                encontrados.map((p) => {
                  const margen = p.precio - p.costo;
                  return (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-gray-800">{p.sellerNombre}</td>
                      <td className="py-2 px-2 text-gray-600">{p.zonaNombre}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{moneda(p.costo)}</td>
                      <td className="py-2 px-2 text-right text-gray-800">{moneda(p.precio)}</td>
                      <td
                        className={`py-2 px-2 text-right font-semibold ${
                          margen < 0 ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        {moneda(margen)}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => editar(p)}
                            className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-150 font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleBorrar(p.id)}
                            disabled={borrando === p.id}
                            className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors duration-150 font-medium"
                          >
                            {borrando === p.id ? '...' : 'Borrar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
            {!loading && encontrados.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold text-gray-700">
                  <td className="py-2 px-2" colSpan={2}>
                    Totales ({encontrados.length})
                  </td>
                  <td className="py-2 px-2 text-right">{moneda(totales.costo)}</td>
                  <td className="py-2 px-2 text-right">{moneda(totales.precio)}</td>
                  <td
                    className={`py-2 px-2 text-right ${
                      totales.precio - totales.costo < 0 ? 'text-red-500' : 'text-green-600'
                    }`}
                  >
                    {moneda(totales.precio - totales.costo)}
                  </td>
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

export default ListasPrecios;
