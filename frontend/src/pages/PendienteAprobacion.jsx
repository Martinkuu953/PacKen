import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const PendienteAprobacion = () => {
  const { usuario, refrescarUsuario, cerrarSesion } = useAuth();
  const [verificando, setVerificando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const rechazado = usuario?.estado_solicitud === 'rechazado';

  const handleVerificar = async () => {
    setVerificando(true);
    setMensaje('');
    try {
      const updated = await refrescarUsuario();
      if (updated?.estado_solicitud === 'aceptado') {
        setMensaje('¡Tu solicitud fue aceptada! Redirigiendo...');
      } else if (updated?.estado_solicitud === 'rechazado') {
        setMensaje('Tu solicitud fue rechazada por la empresa.');
      } else {
        setMensaje('Tu solicitud sigue pendiente. Intentá más tarde.');
      }
    } catch {
      setMensaje('Error al verificar el estado.');
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-md p-6 sm:p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">📦 PacKen</h1>

        {rechazado ? (
          <>
            <div className="my-6 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-4">
              <p className="font-semibold text-lg mb-1">Solicitud rechazada</p>
              <p className="text-sm">
                La empresa rechazó tu solicitud. Contactá al administrador si creés que es un error.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="my-6 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-4">
              <p className="font-semibold text-lg mb-1">Solicitud pendiente</p>
              <p className="text-sm">
                Tu solicitud fue enviada. Esperá a que la empresa te acepte para poder acceder.
              </p>
            </div>

            <button
              onClick={handleVerificar}
              disabled={verificando}
              className="w-full py-2.5 bg-[#FDE047] text-gray-800 font-semibold rounded-xl hover:bg-yellow-300 disabled:opacity-50 transition-colors duration-150 mb-3"
            >
              {verificando ? 'Verificando...' : 'Verificar estado'}
            </button>
          </>
        )}

        {mensaje && (
          <p className="text-sm text-gray-600 mb-3">{mensaje}</p>
        )}

        <button
          onClick={cerrarSesion}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default PendienteAprobacion;
