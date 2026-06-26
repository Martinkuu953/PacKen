import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../services/api';

const Transportistas = () => {
  const [transportistas, setTransportistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formExito, setFormExito] = useState('');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/transportistas/listar');
      setTransportistas(res.transportistas ?? []);
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

  const handleCrear = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormExito('');

    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setCreando(true);
    try {
      await apiFetch('/api/transportistas/crear', {
        method: 'POST',
        body: JSON.stringify({ nombre, email, telefono, password }),
      });

      setFormExito(`Transportista "${nombre}" creado correctamente`);
      setNombre('');
      setEmail('');
      setTelefono('');
      setPassword('');
      cargar();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Transportistas</h2>
          <span className="text-xs sm:text-sm text-gray-500">
            {loading ? 'Cargando...' : `${transportistas.length} registrados`}
          </span>
        </div>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="text-[10px] sm:text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="py-2 px-2">Nombre</th>
                <th className="py-2 px-2">Email</th>
                <th className="py-2 px-2 hidden sm:table-cell">Teléfono</th>
                <th className="py-2 px-2 hidden sm:table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="py-6 px-2 text-center text-gray-500">
                    Cargando transportistas...
                  </td>
                </tr>
              )}
              {!loading && transportistas.length === 0 && !error && (
                <tr>
                  <td colSpan={4} className="py-6 px-2 text-center text-gray-500">
                    No hay transportistas registrados.
                  </td>
                </tr>
              )}
              {!loading &&
                transportistas.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-gray-800">{t.nombre}</td>
                    <td className="py-2 px-2 text-gray-600">{t.email}</td>
                    <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{t.telefono || '—'}</td>
                    <td className="py-2 px-2 text-gray-500 hidden sm:table-cell">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('es-AR') : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Crear transportista</h3>

        {formError && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {formError}
          </p>
        )}
        {formExito && (
          <p className="mb-4 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            {formExito}
          </p>
        )}

        <form onSubmit={handleCrear} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="t-nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <input
              id="t-nombre"
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label htmlFor="t-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="t-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
              placeholder="transportista@email.com"
            />
          </div>

          <div>
            <label htmlFor="t-telefono" className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <input
              id="t-telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
              placeholder="11-1234-5678"
            />
          </div>

          <div>
            <label htmlFor="t-password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="t-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creando}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#FDE047] hover:bg-yellow-400 text-gray-800 font-bold rounded-xl transition-colors duration-150 disabled:opacity-50"
            >
              {creando ? 'Creando...' : 'Crear transportista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Transportistas;
