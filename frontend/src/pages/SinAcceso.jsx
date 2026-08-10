import { useAuth } from '../context/AuthContext';

// Las cuentas de transportista las crea la empresa y nacen activas, así que
// acá solo caen cuentas viejas que quedaron pendientes o rechazadas de cuando
// existía el autorregistro. No hay nada que el usuario pueda hacer por su
// cuenta: ya no existe una solicitud que alguien pueda aprobar.
const SinAcceso = () => {
  const { cerrarSesion } = useAuth();

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-md p-6 sm:p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">📦 PacKen</h1>

        <div className="my-6 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-4">
          <p className="font-semibold text-lg mb-1">Tu cuenta no está activa</p>
          <p className="text-sm">
            Contactá a tu empresa para que te dé de alta como transportista.
          </p>
        </div>

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

export default SinAcceso;
