import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell, { CampoSubrayado, BotonPrincipal } from '../components/auth/AuthShell';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = location.state?.desde?.pathname || '/';

  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(identificador.trim(), contrasena);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err.message || 'No pudimos iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Iniciar Sesión
      </h1>

      <form onSubmit={manejarSubmit} className="space-y-5">
        <CampoSubrayado
          label="Empresa, correo electrónico o teléfono:"
          type="text"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          autoComplete="username"
          required
        />
        <CampoSubrayado
          label="Contraseña"
          type="password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="text-sm text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

        <BotonPrincipal type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Iniciar Sesión'}
        </BotonPrincipal>
      </form>

      <p className="text-sm text-center text-gray-600 mt-6">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-semibold text-[#1f3b8c] hover:underline">
          Registrate
        </Link>
      </p>
    </AuthShell>
  );
}
