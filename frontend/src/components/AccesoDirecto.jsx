import { useEffect, useState } from 'react';

// Mini tutorial para crear el acceso directo de PacKen en la pantalla de
// inicio del celular. Con el manifest (public/manifest.webmanifest) el acceso
// abre PacKen a pantalla completa, con su ícono, como una app.
//
//   modo "aviso"    → tarjeta descartable arriba del contenido, solo en el
//                     celular y solo si todavía no lo abrió desde el acceso.
//   modo "completo" → la sección de Mi Perfil, para volver a verlo cuando sea.

const CLAVE_DESCARTADO = 'packen_aviso_acceso_directo';

function detectarPlataforma() {
  if (typeof navigator === 'undefined') return 'otro';
  const ua = navigator.userAgent || '';
  // iPadOS se presenta como Mac, pero con pantalla táctil.
  const esIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (esIos) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'otro';
}

function yaInstalado() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function leerDescartado() {
  try {
    return localStorage.getItem(CLAVE_DESCARTADO) === '1';
  } catch {
    return false;
  }
}

// Los íconos que la persona va a ver en su navegador, para que los reconozca.
const IconoCompartir = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

const IconoAgregar = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const IconoMenu = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);

const PASOS = {
  ios: {
    titulo: 'En iPhone (Safari)',
    pasos: [
      <>Tocá el botón <strong>Compartir</strong> <IconoCompartir />, en la barra de abajo de Safari.</>,
      <>Bajá en la lista y elegí <strong>Agregar a inicio</strong> <IconoAgregar />.</>,
      <>Tocá <strong>Agregar</strong>, arriba a la derecha.</>,
    ],
    nota: 'Si abriste PacKen desde Chrome u otra app, abrilo primero en Safari.',
  },
  android: {
    titulo: 'En Android (Chrome)',
    pasos: [
      <>Tocá el menú <IconoMenu />, arriba a la derecha.</>,
      <>Elegí <strong>Agregar a la pantalla principal</strong> (en algunos celulares dice <strong>Instalar app</strong>).</>,
      <>Confirmá con <strong>Agregar</strong> o <strong>Instalar</strong>.</>,
    ],
    nota: null,
  },
};

const ListaPasos = ({ plataforma }) => {
  const { titulo, pasos, nota } = PASOS[plataforma];
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800">{titulo}</p>
      <ol className="mt-2 space-y-2">
        {pasos.map((paso, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-700">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-grafito text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{paso}</span>
          </li>
        ))}
      </ol>
      {nota && <p className="mt-2 text-xs text-gray-500">{nota}</p>}
    </div>
  );
};

const AccesoDirecto = ({ modo = 'aviso' }) => {
  const [plataforma] = useState(detectarPlataforma);
  const [instalado] = useState(yaInstalado);
  const [descartado, setDescartado] = useState(leerDescartado);
  // Android/Chrome a veces ofrece instalar con un toque (beforeinstallprompt):
  // si aparece, se suma un botón que lo hace directo.
  const [pedidoInstalar, setPedidoInstalar] = useState(null);

  useEffect(() => {
    const alOfrecer = (e) => {
      e.preventDefault();
      setPedidoInstalar(e);
    };
    window.addEventListener('beforeinstallprompt', alOfrecer);
    return () => window.removeEventListener('beforeinstallprompt', alOfrecer);
  }, []);

  const instalar = async () => {
    if (!pedidoInstalar) return;
    pedidoInstalar.prompt();
    await pedidoInstalar.userChoice.catch(() => null);
    setPedidoInstalar(null);
  };

  const descartar = () => {
    try {
      localStorage.setItem(CLAVE_DESCARTADO, '1');
    } catch {
      // Sin storage vuelve a aparecer la próxima vez; no rompe nada.
    }
    setDescartado(true);
  };

  const esCelular = plataforma === 'ios' || plataforma === 'android';

  if (modo === 'aviso') {
    if (!esCelular || instalado || descartado) return null;
    return (
      <section
        aria-label="Acceso directo a PacKen"
        className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:hidden"
      >
        <div className="flex items-start gap-3">
          <img src="/icono-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-800">Tené PacKen en tu pantalla de inicio</p>
            <p className="mt-0.5 text-sm text-gray-600">Lo abrís con un toque, a pantalla completa, como una app.</p>
          </div>
        </div>

        <div className="mt-4">
          {pedidoInstalar ? (
            <button
              type="button"
              onClick={instalar}
              className="w-full rounded-xl bg-marca-oro py-2.5 text-sm font-semibold text-marca-grafito"
            >
              Agregar a la pantalla de inicio
            </button>
          ) : (
            <ListaPasos plataforma={plataforma} />
          )}
        </div>

        <button
          type="button"
          onClick={descartar}
          className="mt-4 w-full rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600"
        >
          Ahora no
        </button>
      </section>
    );
  }

  // Modo completo (Mi Perfil).
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 className="text-sm font-bold text-gray-800 mb-1">Acceso directo en el celular</h3>
      {instalado ? (
        <p className="text-sm text-gray-600">Ya estás usando PacKen desde el acceso directo.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            {esCelular
              ? 'Agregá PacKen a la pantalla de inicio para abrirlo con un toque, como una app.'
              : 'Abrí PacKen desde el celular y seguí estos pasos para tenerlo en la pantalla de inicio.'}
          </p>
          {pedidoInstalar && (
            <button
              type="button"
              onClick={instalar}
              className="mb-4 rounded-lg bg-marca-oro px-4 py-2 text-sm font-semibold text-marca-grafito"
            >
              Agregar a la pantalla de inicio
            </button>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {(esCelular ? [plataforma] : ['ios', 'android']).map((p) => (
              <ListaPasos key={p} plataforma={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AccesoDirecto;
