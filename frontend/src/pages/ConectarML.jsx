import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiUrl } from '../services/api';
import Logo from '../components/Logo';

// Página pública del link de invitación. La abre el seller desde su celular y
// no requiere sesión: el seller no es usuario de PacKen. Tiene dos entradas:
//
//   /conectar-ml?inv=X       → quién lo invita y el botón para ir a ML
//   /conectar-ml?estado=...  → el resultado, cuando vuelve de ML (lo manda
//                              /api/ml/callback) o cuando el link no sirve
//
// Los textos que ve el seller viven acá; el backend solo manda el motivo.

const RESULTADOS = {
  ok: {
    exito: true,
    titulo: '¡Listo! Tu cuenta quedó conectada',
    texto: 'La empresa ya puede ver los envíos Flex que le despachás. Podés cerrar esta ventana.',
  },
  'otra-empresa': {
    titulo: 'Esta cuenta ya está conectada a otra empresa',
    texto:
      'Tu cuenta de Mercado Libre ya trabaja con otra empresa en PacKen, y no se puede mover sola. ' +
      'Avisale a la empresa que te invitó.',
  },
  vencida: {
    titulo: 'La invitación venció',
    texto: 'Pedile a la empresa que te mande un link nuevo.',
  },
  invalida: {
    titulo: 'El link no es válido',
    texto: 'Revisá que esté completo, o pedile a la empresa que te lo vuelva a mandar.',
  },
  error: {
    titulo: 'No se pudo completar la conexión',
    texto:
      'Si cancelaste en Mercado Libre, podés volver a abrir el mismo link mientras no venza. ' +
      'Abrilo en Chrome o Safari, no adentro de otra app: la conexión tiene que empezar y ' +
      'terminar en el mismo navegador.',
  },
};

const formatearVencimiento = (iso) =>
  new Date(iso).toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  });

const Tarjeta = ({ children }) => (
  <div className="min-h-screen bg-marca-crema flex items-center justify-center px-4 py-8">
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-md p-6 sm:p-8">
      <div className="mb-6 flex justify-center">
        <Logo className="h-9" />
      </div>
      {children}
    </div>
  </div>
);

const Resultado = ({ clave }) => {
  const r = RESULTADOS[clave] ?? RESULTADOS.error;
  return (
    <Tarjeta>
      <div
        className={`rounded-lg px-4 py-4 text-center border ${
          r.exito
            ? 'text-green-800 bg-green-50 border-green-200'
            : 'text-red-700 bg-red-50 border-red-200'
        }`}
      >
        <p className="font-semibold text-lg mb-1">{r.titulo}</p>
        <p className="text-sm">{r.texto}</p>
      </div>
    </Tarjeta>
  );
};

const ConectarML = () => {
  const [searchParams] = useSearchParams();
  const estado = searchParams.get('estado');
  const inv = searchParams.get('inv');

  const [invitacion, setInvitacion] = useState(null);
  const [motivo, setMotivo] = useState(null);

  useEffect(() => {
    if (estado || !inv) return;
    let cancelado = false;

    // fetch directo y no apiFetch: apiFetch está pensado para alguien con
    // sesión (ante un 401 intenta refrescar y manda a /login), y acá además
    // hace falta el `motivo` del cuerpo, que apiFetch descarta.
    fetch(apiUrl(`/api/ml/invitacion?inv=${encodeURIComponent(inv)}`), { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelado) return;
        if (res.ok) setInvitacion(body);
        else setMotivo(body.motivo ?? 'error');
      })
      .catch(() => {
        if (!cancelado) setMotivo('error');
      });

    return () => {
      cancelado = true;
    };
  }, [estado, inv]);

  if (estado) return <Resultado clave={estado} />;
  if (!inv) return <Resultado clave="invalida" />;
  if (motivo) return <Resultado clave={motivo} />;

  if (!invitacion) {
    return (
      <Tarjeta>
        <p className="text-center text-sm text-gray-500">Cargando invitación...</p>
      </Tarjeta>
    );
  }

  // Navegación de verdad, no fetch: el backend deja la cookie del OAuth en este
  // navegador y redirige a Mercado Libre.
  const urlAutorizar = apiUrl(`/api/ml/invitacion?inv=${encodeURIComponent(inv)}&autorizar=1`);

  return (
    <Tarjeta>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center mb-2">
        Invitación
      </p>
      <h2 className="text-xl font-bold text-gray-800 text-center mb-4">
        {invitacion.empresa} te invita a conectar tu cuenta de Mercado Libre
      </h2>

      <p className="text-sm text-gray-600 mb-4">
        PacKen usa este acceso para leer los envíos Flex que le despachás a{' '}
        <span className="font-semibold">{invitacion.empresa}</span>: estado, destinatario y
        dirección de entrega. Así la empresa los sigue sin que tengas que pasarle los datos a mano.
      </p>

      <ul className="text-sm text-gray-600 space-y-2 mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <li>
          Vas a iniciar sesión <span className="font-semibold">en Mercado Libre</span>, no en
          PacKen: tu contraseña nunca pasa por nosotros.
        </li>
        <li>
          Si en este navegador está abierta <span className="font-semibold">otra</span> cuenta de
          Mercado Libre, cerrala antes: se conecta la cuenta que esté logueada.
        </li>
      </ul>

      <a
        href={urlAutorizar}
        className="block w-full text-center py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl transition-colors duration-150"
      >
        Conectar con Mercado Libre
      </a>

      <p className="mt-4 text-xs text-gray-400 text-center">
        La invitación vence el {formatearVencimiento(invitacion.vence)}.
      </p>
    </Tarjeta>
  );
};

export default ConectarML;
