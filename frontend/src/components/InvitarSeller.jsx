import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/api';

// Link de invitación para que un seller conecte su cuenta de ML desde su propio
// celular (ver api/_lib/ml/invitacion.js). Se pide uno nuevo cada vez que se
// abre el panel: no hay nada que listar ni revocar, cada link vence solo.
const InvitarSeller = ({ onCerrar }) => {
  const [invitacion, setInvitacion] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    apiFetch('/api/ml/invitacion', { method: 'POST' })
      .then((res) => {
        if (!cancelado) setInvitacion(res);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(invitacion.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (navegador viejo, http): se deja el link
      // seleccionado para copiarlo a mano.
      inputRef.current?.select();
    }
  };

  const mensajeWhatsApp = invitacion
    ? 'Hola! Para gestionar tus envíos Flex necesitamos que conectes tu cuenta de ' +
      `Mercado Libre con PacKen. Es un minuto, desde este link: ${invitacion.url}`
    : '';

  return (
    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <h3 className="text-sm font-bold text-gray-800 mb-1">Invitar seller</h3>
      <p className="text-sm text-gray-600 mb-3">
        Mandale este link al seller. Lo abre en su celular, inicia sesión en Mercado Libre y
        autoriza a PacKen. Cuando termina, aparece en esta lista.
      </p>

      {error && (
        <p className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!invitacion && !error && <p className="text-sm text-gray-500">Generando link...</p>}

      {invitacion && (
        <>
          <input
            ref={inputRef}
            readOnly
            value={invitacion.url}
            onFocus={(e) => e.target.select()}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
            aria-label="Link de invitación"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copiar}
              className="text-sm px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium"
            >
              {copiado ? '¡Copiado!' : 'Copiar link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Enviar por WhatsApp
            </a>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Vence el{' '}
            {new Date(invitacion.vence).toLocaleString('es-AR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'America/Argentina/Buenos_Aires',
            })}
            . Sirve para más de un seller: cada uno conecta su propia cuenta. No lo publiques:
            hasta que venza, cualquiera que lo tenga puede conectar su cuenta a tu empresa.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onCerrar}
        className="mt-3 text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        Cerrar
      </button>
    </div>
  );
};

export default InvitarSeller;
