import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import FormNuevoTransportista from '../components/FormNuevoTransportista';
import DetalleTransportista from '../components/DetalleTransportista';
import { filtrarPorTexto } from '../utils/busqueda';

const CAMPOS_BUSQUEDA = ['nombre', 'dni'];

const ENDPOINT = '/api/transportistas';

const formatearFecha = (iso) => {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-AR');
};

const Transportistas = () => {
  const [transportistas, setTransportistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [creando, setCreando] = useState(false);
  const [transportistaSeleccionado, setTransportistaSeleccionado] = useState(null);

  const aplicar = useCallback((res) => {
    setTransportistas(res.transportistas ?? []);
    setError('');
  }, []);

  const recargar = useCallback(
    () => apiFetch(ENDPOINT).then(aplicar).catch((err) => setError(err.message)),
    [aplicar],
  );

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

  const transportistaEliminado = useCallback((transportistaId) => {
    setTransportistas((prev) => prev.filter((t) => t.id !== transportistaId));
    setTransportistaSeleccionado(null);
  }, []);

  // Todos los transportistas de la empresa son activos: las cuentas las crea
  // ella misma, no hay solicitudes que aprobar.
  const encontrados = useMemo(
    () => filtrarPorTexto(transportistas, busqueda, CAMPOS_BUSQUEDA),
    [transportistas, busqueda],
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between mb-4 sm:mb-6 gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Transportistas</h2>
            <p className="text-sm text-gray-500 mt-1">
              {loading
                ? 'Cargando...'
                : `${transportistas.length} activo${transportistas.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreando((prev) => !prev)}
              className="text-xs sm:text-sm px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors duration-150 font-medium whitespace-nowrap"
            >
              Nuevo transportista
            </button>
          </div>
        </div>

        {creando && (
          <FormNuevoTransportista
            onCreado={() => {
              setCreando(false);
              recargar();
            }}
            onCancelar={() => setCreando(false)}
          />
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {!loading && transportistas.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar transportista por nombre o DNI..."
            resultados={encontrados.length}
            total={transportistas.length}
          />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">Nombre</th>
                <th className="py-2 px-2">DNI</th>
                <th className="py-2 px-2">Alta</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="py-6 px-2 text-center text-gray-500">
                    Cargando transportistas...
                  </td>
                </tr>
              )}
              {!loading && encontrados.length === 0 && !error && (
                <tr>
                  <td colSpan={3} className="py-6 px-2 text-center text-gray-500">
                    {busqueda.trim()
                      ? `Ningún transportista coincide con "${busqueda.trim()}".`
                      : 'Todavía no creaste ningún transportista.'}
                  </td>
                </tr>
              )}
              {!loading &&
                encontrados.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setTransportistaSeleccionado(t)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-2 px-2 font-medium text-gray-800">{t.nombre}</td>
                    <td className="py-2 px-2 text-gray-600">{t.dni || '—'}</td>
                    <td className="py-2 px-2 text-gray-600">{formatearFecha(t.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {transportistaSeleccionado && (
        <DetalleTransportista
          transportista={transportistaSeleccionado}
          onCerrar={() => setTransportistaSeleccionado(null)}
          onEliminado={transportistaEliminado}
        />
      )}
    </div>
  );
};

export default Transportistas;
