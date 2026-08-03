import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const CAMPOS_BUSQUEDA = ['nombre', 'dni'];

// Reusamos /api/solicitudes: ya devuelve todos los transportistas de la
// empresa con su estado. Un endpoint propio sería otra Serverless Function y
// el plan Hobby de Vercel permite 12 (hoy hay 11).
const ENDPOINT = '/api/solicitudes';

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

  const aplicar = useCallback((res) => {
    setTransportistas(res.solicitudes ?? []);
    setError('');
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

  // Esta pantalla es la flota activa. Los pendientes y rechazados se manejan
  // en Solicitudes.
  const activos = useMemo(
    () => transportistas.filter((t) => t.estado_solicitud === 'aceptado'),
    [transportistas],
  );

  const pendientes = useMemo(
    () => transportistas.filter((t) => t.estado_solicitud === 'pendiente').length,
    [transportistas],
  );

  const encontrados = useMemo(
    () => filtrarPorTexto(activos, busqueda, CAMPOS_BUSQUEDA),
    [activos, busqueda],
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Transportistas</h2>
            <p className="text-sm text-gray-500 mt-1">
              {loading ? 'Cargando...' : `${activos.length} activo${activos.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {pendientes > 0 && (
            <Link
              to="/solicitudes"
              className="text-xs sm:text-sm px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors duration-150 font-medium whitespace-nowrap"
            >
              {pendientes} pendiente{pendientes === 1 ? '' : 's'} →
            </Link>
          )}
        </div>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {!loading && activos.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar transportista por nombre o DNI..."
            resultados={encontrados.length}
            total={activos.length}
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
                      : 'Todavía no tenés transportistas aceptados.'}
                  </td>
                </tr>
              )}
              {!loading &&
                encontrados.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-800">{t.nombre}</td>
                    <td className="py-2 px-2 text-gray-600">{t.dni || '—'}</td>
                    <td className="py-2 px-2 text-gray-600">{formatearFecha(t.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transportistas;
