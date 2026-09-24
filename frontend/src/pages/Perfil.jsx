import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ENDPOINT = '/api/auth/perfil';

const INPUT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-marca-oro';
const LABEL = 'block text-[11px] font-semibold text-gray-500 uppercase mb-1';
const BOTON = 'text-sm px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium';

const PASSWORDS_VACIAS = { passwordActual: '', passwordNueva: '', repetir: '' };

function formatearFecha(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// Dato que se muestra pero no se edita.
const Campo = ({ etiqueta, valor, nota }) => (
  <div>
    <span className={LABEL}>{etiqueta}</span>
    <p className="text-sm text-gray-800">{valor}</p>
    {nota && <p className="text-xs text-gray-500 mt-1">{nota}</p>}
  </div>
);

const Aviso = ({ tipo, children }) => {
  if (!children) return null;
  const estilos = tipo === 'error'
    ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-green-700 bg-green-50 border-green-200';
  return <p className={'mb-3 text-sm border rounded-lg px-3 py-2 ' + estilos}>{children}</p>;
};

const Perfil = () => {
  const { refrescarUsuario } = useAuth();

  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [nombre, setNombre] = useState('');
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [datosError, setDatosError] = useState('');
  const [datosOk, setDatosOk] = useState('');

  const [passwords, setPasswords] = useState(PASSWORDS_VACIAS);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordOk, setPasswordOk] = useState('');

  useEffect(() => {
    let cancelado = false;
    apiFetch(ENDPOINT)
      .then((res) => {
        if (cancelado) return;
        setPerfil(res.perfil);
        setNombre(res.perfil?.nombre ?? '');
      })
      .catch((err) => {
        if (!cancelado) setErrorCarga(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const guardarNombre = async (e) => {
    e.preventDefault();
    setGuardandoNombre(true);
    setDatosError('');
    setDatosOk('');
    try {
      const res = await apiFetch(ENDPOINT, {
        method: 'PATCH',
        body: JSON.stringify({ nombre }),
      });
      setPerfil(res.perfil);
      setNombre(res.perfil.nombre);
      // El sidebar muestra el nombre desde el contexto, no desde esta pantalla:
      // sin esto seguiría mostrando el viejo hasta el próximo login.
      await refrescarUsuario();
      setDatosOk('Nombre actualizado.');
    } catch (err) {
      setDatosError(err.message);
    } finally {
      setGuardandoNombre(false);
    }
  };

  const cambiarPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordOk('');

    // La repetición se valida acá nomás: es un error de tipeo del usuario, no
    // hay nada que el servidor pueda decir al respecto.
    if (passwords.passwordNueva !== passwords.repetir) {
      setPasswordError('Las contraseñas nuevas no coinciden');
      return;
    }

    setGuardandoPassword(true);
    try {
      await apiFetch(ENDPOINT, {
        method: 'PATCH',
        body: JSON.stringify({
          passwordActual: passwords.passwordActual,
          passwordNueva: passwords.passwordNueva,
        }),
      });
      setPasswords(PASSWORDS_VACIAS);
      setPasswordOk('Contraseña actualizada. Si tenías la sesión abierta en otro dispositivo, se cerró.');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setGuardandoPassword(false);
    }
  };

  const setPassword = (campo) => (e) => {
    const { value } = e.target;
    setPasswords((prev) => ({ ...prev, [campo]: value }));
  };

  if (cargando) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <Aviso tipo="error">{errorCarga}</Aviso>
        </div>
      </div>
    );
  }

  const esTransportista = perfil?.rol === 'transportista';
  const sinCambios = nombre.trim() === (perfil?.nombre ?? '');

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Mi Perfil</h2>
          <p className="text-sm text-gray-500 mt-1 capitalize">
            {perfil?.rol}
            {esTransportista && perfil?.estado_solicitud ? ' · ' + perfil.estado_solicitud : ''}
          </p>
        </div>

        <Aviso tipo="error">{datosError}</Aviso>
        <Aviso tipo="ok">{datosOk}</Aviso>

        <form onSubmit={guardarNombre}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} htmlFor="perfil-nombre">Nombre</label>
              <input
                id="perfil-nombre"
                className={INPUT}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                minLength={2}
                required
              />
            </div>

            <Campo
              etiqueta="Email"
              valor={perfil?.email ?? '—'}
              nota="Es tu usuario para entrar. Si necesitás cambiarlo, pedíselo a soporte."
            />

            {esTransportista && <Campo etiqueta="DNI" valor={perfil?.dni ?? '—'} />}

            <Campo etiqueta="Miembro desde" valor={formatearFecha(perfil?.created_at)} />
          </div>

          <div className="mt-4">
            <button type="submit" disabled={guardandoNombre || sinCambios} className={BOTON}>
              {guardandoNombre ? 'Guardando...' : 'Guardar nombre'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Cambiar contraseña</h3>
        <p className="text-xs text-gray-500 mb-4">
          Al cambiarla se cierran las sesiones abiertas en otros dispositivos. Esta se mantiene.
        </p>

        <Aviso tipo="error">{passwordError}</Aviso>
        <Aviso tipo="ok">{passwordOk}</Aviso>

        <form onSubmit={cambiarPassword}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL} htmlFor="perfil-pass-actual">Contraseña actual</label>
              <input
                id="perfil-pass-actual"
                type="password"
                autoComplete="current-password"
                className={INPUT}
                value={passwords.passwordActual}
                onChange={setPassword('passwordActual')}
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="perfil-pass-nueva">Nueva</label>
              <input
                id="perfil-pass-nueva"
                type="password"
                autoComplete="new-password"
                className={INPUT}
                value={passwords.passwordNueva}
                onChange={setPassword('passwordNueva')}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="perfil-pass-repetir">Repetir nueva</label>
              <input
                id="perfil-pass-repetir"
                type="password"
                autoComplete="new-password"
                className={INPUT}
                value={passwords.repetir}
                onChange={setPassword('repetir')}
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <button type="submit" disabled={guardandoPassword} className={BOTON}>
              {guardandoPassword ? 'Cambiando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Perfil;
