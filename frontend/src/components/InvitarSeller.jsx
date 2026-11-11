import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../services/api';

// Conecta con Mercado Libre un seller que la empresa ya creó en "Nuevo seller".
// Dos caminos, los dos completan ESA fila (nunca crean otro seller):
//
//   - Link de invitación: el seller lo abre en su celular y autoriza desde ahí
//     (ver api/_lib/ml/invitacion.js). Es el normal: no hace falta que esté
//     presente ni que pase su contraseña.
//   - Desde esta compu: redirige a ML en esta misma pestaña, para cuando el
//     seller está sentado al lado.
//
// Se pide un link nuevo cada vez que se abre el panel: no hay nada que listar
// ni revocar, cada link vence solo.
const InvitarSeller = ({ seller, onCerrar }) => {
  const [invitacion, setInvitacion] = useState(null);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [redirigiendo, setRedirigiendo] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    apiFetch('/api/ml/invitacion', { method: 'POST', body: JSON.stringify({ sellerId: seller.id }) })
      .then((res) => {
        if (!cancelado) setInvitacion(res);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      });
    return () => {
      cancelado = true;
    };
  }, [seller.id]);

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

  const conectarAca = () => {
    setRedirigiendo(true);
    setError('');
    apiFetch(`/api/ml/conectar?sellerId=${encodeURIComponent(seller.id)}`)
      .then((res) => {
        window.location.href = res.url;
      })
      .catch((err) => {
        setError(err.message);
        setRedirigiendo(false);
      });
  };

  const mensajeWhatsApp = invitacion
    ? 'Hola! Para gestionar tus envíos Flex necesitamos que conectes tu cuenta de ' +
      `Mercado Libre con PacKen. Es un minuto, desde este link: ${invitacion.url}`
    : '';

  return (
    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <h3 className="text-sm font-bold text-gray-800 mb-1">
        {seller.conectado ? 'Reconectar' : 'Conectar'} a {seller.nombre} con Mercado Libre
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        {seller.conectado
          ? 'Ya está conectado. Reconectalo solo si dejaron de leerse sus envíos (por ejemplo, si quitó el permiso en Mercado Libre). Tiene que autorizar la misma cuenta.'
          : 'Hasta que se conecte no se pueden leer sus envíos: el escaneo de sus paquetes va a fallar.'}
      </p>

      {error && (
        <p className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Mandale este link</p>
      <p className="text-xs text-gray-500 mb-2">
        Lo abre en su celular, inicia sesión en Mercado Libre y autoriza a PacKen.
      </p>

      {!invitacion && !error && <p className="text-sm text-gray-500">Generando link...</p>}

      {invitacion && (
        <>
          <input
            ref={inputRef}
            readOnly
            value={invitacion.url}
            onFocus={(e) => e.target.select()}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
            aria-label={`Link de invitación de ${seller.nombre}`}
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

          <p className="mt-2 text-xs text-gray-500">
            Vence el{' '}
            {new Date(invitacion.vence).toLocaleString('es-AR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'America/Argentina/Buenos_Aires',
            })}
            . Sirve solo para {seller.nombre}: una vez conectado, queda atado a esa cuenta.
          </p>
        </>
      )}

      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">O desde esta compu</p>
        <p className="text-xs text-gray-500 mb-2">
          Si el seller está con vos. Se conecta la cuenta de Mercado Libre que inicie sesión en este
          navegador: si tenés la tuya abierta, usá una ventana de incógnito.
        </p>
        <button
          type="button"
          onClick={conectarAca}
          disabled={redirigiendo}
          className="text-sm px-4 py-2 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-200 font-medium disabled:opacity-60"
        >
          {redirigiendo ? 'Redirigiendo...' : 'Conectar desde esta compu'}
        </button>
      </div>

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
