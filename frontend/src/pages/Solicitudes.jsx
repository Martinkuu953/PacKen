import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import Buscador from '../components/Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

const CAMPOS_BUSQUEDA = ['nombre', 'dni'];

const Solicitudes = () => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/solicitudes');
      setSolicitudes(res.solicitudes ?? []);
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

  const handleAccion = async (id, estado) => {
    setProcesando(id);
    try {
      await apiFetch(`/api/solicitudes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      cargar();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcesando(null);
    }
  };

  const encontradas = useMemo(
    () => filtrarPorTexto(solicitudes, busqueda, CAMPOS_BUSQUEDA),
    [solicitudes, busqueda],
  );

  const pendientes = encontradas.filter((s) => s.estado_solicitud === 'pendiente');
  const resueltas = encontradas.filter((s) => s.estado_solicitud !== 'pendiente');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">
          Solicitudes de transportistas
        </h2>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {!loading && solicitudes.length > 0 && (
          <Buscador
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar transportista por nombre o DNI..."
            resultados={encontradas.length}
            total={solicitudes.length}
          />
        )}

        {loading && <p className="text-gray-500 text-sm">Cargando...</p>}

        {!loading && pendientes.length === 0 && (
          <p className="text-gray-500 text-sm mb-6">
            {busqueda.trim()
              ? `Ninguna solicitud pendiente coincide con "${busqueda.trim()}".`
              : 'No hay solicitudes pendientes.'}
          </p>
        )}

        {!loading && pendientes.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Pendientes</h3>
            {pendientes.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">{s.nombre}</p>
                  <p className="text-xs text-gray-500">DNI: {s.dni || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccion(s.id, 'aceptado')}
                    disabled={procesando === s.id}
                    className="px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleAccion(s.id, 'rechazado')}
                    disabled={procesando === s.id}
                    className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && resueltas.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Historial</h3>
            {resueltas.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">{s.nombre}</p>
                  <p className="text-xs text-gray-500">DNI: {s.dni || '—'}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    s.estado_solicitud === 'aceptado'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {s.estado_solicitud === 'aceptado' ? 'Aceptado' : 'Rechazado'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Solicitudes;
