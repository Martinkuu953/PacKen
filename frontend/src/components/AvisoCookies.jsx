import { useState } from 'react';
import { Link } from 'react-router-dom';

// Aviso de cookies. PacKen solo usa cookies estrictamente necesarias (la de
// sesión), que no requieren consentimiento previo: el aviso informa y se
// cierra. Si algún día se suma analítica o publicidad, esto tiene que pasar a
// ser un consentimiento real (aceptar / rechazar) ANTES de cargar esos scripts.
const CLAVE = 'packen_aviso_cookies';

function yaVisto() {
  try {
    return localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

const AvisoCookies = () => {
  const [visible, setVisible] = useState(() => !yaVisto());

  if (!visible) return null;

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {
      // Sin storage se vuelve a mostrar en la próxima visita; no rompe nada.
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-gray-700 flex-1">
          Usamos solo cookies necesarias para que funcione el inicio de sesión. No usamos cookies de publicidad ni de
          seguimiento.{' '}
          <Link to="/cookies" className="text-yellow-700 underline whitespace-nowrap">
            Más información
          </Link>
        </p>
        <button
          type="button"
          onClick={cerrar}
          className="shrink-0 rounded-xl bg-marca-grafito px-5 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          Entendido
        </button>
      </div>
    </div>
  );
};

export default AvisoCookies;
