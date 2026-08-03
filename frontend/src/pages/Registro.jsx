import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

const Registro = () => {
  const { registrar } = useAuth();
  const [rol, setRol] = useState(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [idempresa, setIdempresa] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (rol === 'transportista') {
      apiFetch('/api/empresas')
        .then((res) => setEmpresas(res.empresas ?? []))
        .catch(() => setEmpresas([]));
    }
  }, [rol]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (rol === 'transportista' && !idempresa) {
      setError('Debe seleccionar una empresa');
      return;
    }

    setCargando(true);
    try {
      await registrar({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        dni: rol === 'transportista' ? dni.trim() : undefined,
        rol,
        // public_id de la empresa (UUID opaco), no un id numérico.
        idempresa: rol === 'transportista' ? idempresa : undefined,
      });
    } catch (err) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setCargando(false);
    }
  };

  if (!rol) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-md p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
              📦 PacKen
            </h1>
            <p className="text-gray-500 text-sm mt-2">¿Cómo querés registrarte?</p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setRol('transportista')}
              className="w-full py-4 text-lg font-semibold text-gray-800 bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-150"
            >
              Soy Transportista
            </button>
            <button
              onClick={() => setRol('empresa')}
              className="w-full py-4 text-lg font-semibold text-gray-800 bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 transition-all duration-150"
            >
              Soy Empresa
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-yellow-600 font-semibold hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
            📦 PacKen
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Registro como <span className="font-semibold capitalize">{rol}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre completo"
              required
              autoComplete="name"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
            />
          </div>

          {rol === 'transportista' && (
            <>
              <div>
                <label htmlFor="dni" className="block text-sm font-medium text-gray-700 mb-1">
                  DNI
                </label>
                <input
                  id="dni"
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Tu número de DNI"
                  required
                  inputMode="numeric"
                  pattern="\d+"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="empresa" className="block text-sm font-medium text-gray-700 mb-1">
                  Empresa
                </label>
                {empresas.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No hay empresas registradas aún.</p>
                ) : (
                  <select
                    id="empresa"
                    value={idempresa}
                    onChange={(e) => setIdempresa(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">Seleccioná una empresa</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="confirmar" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              id="confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repetí la contraseña"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={cargando || (rol === 'transportista' && empresas.length === 0)}
            className="w-full py-2.5 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150"
          >
            {cargando ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-6 text-sm text-gray-500">
          <button
            onClick={() => setRol(null)}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            ← Cambiar rol
          </button>
          <Link to="/login" className="text-yellow-600 font-semibold hover:underline">
            Iniciá sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Registro;
