import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import '@fontsource-variable/archivo/wdth.css';
import './Landing.css';
import Logo from '../components/Logo';
import { DATOS_LEGALES, esMarcador } from '../legal/datosLegales';

// Landing pública.
//
// Concepto: el objeto característico del rubro es la etiqueta de envío. El hero
// es una caja de PacKen (grafito con la cinta del logo) con una etiqueta que se
// escanea y avanza de estado: es el único momento animado de la página. El
// resto es sobrio a propósito.
//
// Todo lo que se afirma tiene que existir en la app: nada de cifras, clientes
// ni testimonios que no sean reales (Ley 24.240 art. 9, Ley 22.802).

// ── Contenido ───────────────────────────────────────────────────────────────

// El recorrido real de un paquete en PacKen: es una secuencia, por eso va como
// una línea de seguimiento.
const RECORRIDO = [
  {
    etapa: 'Colecta',
    quien: 'Transportista',
    texto: 'Escanea el QR de la etiqueta al retirar. El envío entra con el comprador, la dirección y el barrio.',
  },
  {
    etapa: 'Reparto',
    quien: 'Transportista y empresa',
    texto: 'Vuelve a escanear al salir. Desde el panel ves a quién está asignado cada paquete y lo podés reasignar.',
  },
  {
    etapa: 'Entrega',
    quien: 'Automático',
    texto: 'Cuando Mercado Libre informa la entrega, el estado cambia solo. Cada cambio queda en el historial.',
  },
  {
    etapa: 'Cierre',
    quien: 'Empresa',
    texto: 'Con tus listas de precios y costos por zona sacás lo que cobrás a cada seller y lo que pagás a cada transportista.',
  },
];

const EN_EL_PANEL = [
  'Todos los envíos, con filtros por seller, transportista, estado y fecha',
  'Reasignación de paquetes entre transportistas',
  'Zonas armadas con los barrios de Flex y listas de precios y costos',
  'Estadísticas por partido, resúmenes de cobro y liquidaciones en Excel',
  'El historial de cada paquete: quién lo movió y cuándo',
];

const EN_EL_CELULAR = [
  'Dos botones: Colecta y Reparto',
  'Escaneo del QR con la cámara, sin instalar ninguna aplicación',
  'Solo ve los paquetes que tiene asignados',
  'Cambia su contraseña desde su perfil',
];

const PREGUNTAS = [
  { q: '¿Para quién es PacKen?', a: 'Para empresas de logística que reparten envíos de Mercado Libre (por ejemplo, Flex) con su propia flota. No está pensado para vendedores individuales.' },
  { q: '¿Necesito instalar algo?', a: 'No. El panel funciona desde el navegador y los transportistas usan PacKen desde el celular, sin instalar ninguna aplicación.' },
  { q: '¿Cómo entran los envíos?', a: 'Conectás las cuentas de Mercado Libre de tus sellers y tus transportistas escanean el QR de cada etiqueta. Los estados se actualizan solos con la información de Mercado Libre.' },
  { q: '¿Las facturas sirven como comprobante fiscal?', a: 'No. Son resúmenes internos para saber cuánto cobrarle a cada seller y cuánto pagarle a cada transportista. Las facturas fiscales las seguís emitiendo ante ARCA.' },
  { q: '¿Cuánto cuesta?', a: 'Hoy el registro y el uso son gratuitos. Si en el futuro hay planes pagos, se avisará con anticipación y no se cobrará nada sin que lo aceptes.' },
  { q: '¿Qué pasa con los datos de los compradores?', a: 'Se usan solo para gestionar las entregas. No se venden ni se usan para publicidad.' },
];

// ── Etiqueta del hero ───────────────────────────────────────────────────────

// QR decorativo: patrón fijo (siempre el mismo) con los tres cuadros de
// posición de un QR real. No codifica nada.
const QR_N = 25;
const MODULOS_QR = (() => {
  let semilla = 4419;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla / 2147483648;
  };
  const enFinder = (x, y) =>
    [
      [0, 0],
      [QR_N - 7, 0],
      [0, QR_N - 7],
    ].find(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
  const modulos = [];
  for (let y = 0; y < QR_N; y++) {
    for (let x = 0; x < QR_N; x++) {
      if (enFinder(x, y)) continue;
      if (azar() < 0.48) modulos.push([x, y]);
    }
  }
  return modulos;
})();

const Finder = ({ x, y }) => (
  <g>
    <rect x={x} y={y} width="7" height="7" fill="currentColor" />
    <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
    <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
  </g>
);

const QR = () => (
  <svg viewBox={`0 0 ${QR_N} ${QR_N}`} className="h-full w-full text-[var(--grafito)]" shapeRendering="crispEdges">
    {MODULOS_QR.map(([x, y]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
    ))}
    <Finder x={0} y={0} />
    <Finder x={QR_N - 7} y={0} />
    <Finder x={0} y={QR_N - 7} />
  </svg>
);

const ESTADOS = [
  { nombre: 'Ingresado', detalle: 'Escaneado en la colecta', hora: '09:12' },
  { nombre: 'En camino', detalle: 'Asignado a Juan Pérez', hora: '11:40' },
  { nombre: 'Entregado', detalle: 'Informado por Mercado Libre', hora: '15:03' },
];

// Tiempos de la secuencia, en ms desde que arranca.
const SECUENCIA = { escaneo: 700, ingresado: 1700, enCamino: 2900, entregado: 4200 };

function useSecuencia() {
  const reducir = useReducedMotion();
  // paso: 0 = etiqueta sin escanear, 1..3 = estados alcanzados. Con
  // "reducir movimiento" se muestra directamente el final.
  const [paso, setPaso] = useState(0);
  const [escaneando, setEscaneando] = useState(false);
  const [vuelta, setVuelta] = useState(0);

  // El efecto solo agenda los cambios; el estado se toca en los timers (y en
  // repetir, que es un evento del usuario), nunca de forma sincrónica acá.
  useEffect(() => {
    if (reducir) return undefined;
    const timers = [
      setTimeout(() => setEscaneando(true), SECUENCIA.escaneo),
      setTimeout(() => {
        setEscaneando(false);
        setPaso(1);
      }, SECUENCIA.ingresado),
      setTimeout(() => setPaso(2), SECUENCIA.enCamino),
      setTimeout(() => setPaso(3), SECUENCIA.entregado),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reducir, vuelta]);

  const repetir = useCallback(() => {
    setPaso(0);
    setEscaneando(false);
    setVuelta((v) => v + 1);
  }, []);
  return { paso: reducir ? 3 : paso, escaneando, repetir, reducir };
}

// Hex y no var(--...): motion interpola colores, no variables CSS.
const COLOR = { grafito: '#2e3136', cinta: '#f2b400', entregado: '#1f7a4d', linea: '#dcddd8' };

const Seguimiento = ({ paso }) => (
  <ol className="relative" aria-label="Estado del envío de ejemplo">
    {ESTADOS.map((e, i) => {
      const alcanzado = paso > i;
      const actual = paso === i + 1;
      const ultimo = i === ESTADOS.length - 1;
      const color = ultimo && alcanzado ? COLOR.entregado : actual ? COLOR.cinta : COLOR.grafito;
      return (
        <li key={e.nombre} className="relative flex gap-4 pb-6 last:pb-0">
          {!ultimo && (
            <span className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-[2px] bg-[var(--linea)]" aria-hidden="true">
              <motion.span
                className="block w-full origin-top bg-[var(--grafito)]"
                initial={false}
                animate={{ scaleY: paso > i + 1 ? 1 : 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{ height: '100%' }}
              />
            </span>
          )}
          <motion.span
            className="relative mt-1 h-4 w-4 shrink-0 rounded-full border-2"
            initial={false}
            animate={{
              backgroundColor: alcanzado ? color : '#ffffff',
              borderColor: alcanzado ? color : COLOR.linea,
              scale: actual ? [1, 1.25, 1] : 1,
            }}
            transition={{ duration: 0.45 }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <motion.p
                className="titulo text-[26px]"
                initial={false}
                animate={{ opacity: alcanzado ? 1 : 0.32 }}
                transition={{ duration: 0.35 }}
              >
                {e.nombre}
              </motion.p>
              <motion.span
                className="cifra text-sm text-[var(--tinta-2)]"
                initial={false}
                animate={{ opacity: alcanzado ? 1 : 0 }}
              >
                {e.hora}
              </motion.span>
            </div>
            <motion.p
              className="text-sm text-[var(--tinta-2)]"
              initial={false}
              animate={{ opacity: alcanzado ? 1 : 0.32 }}
            >
              {e.detalle}
            </motion.p>
          </div>
          {/* Para lectores de pantalla, el estado sin depender del color. */}
          <span className="sr-only">{alcanzado ? '(completado)' : '(pendiente)'}</span>
        </li>
      );
    })}
  </ol>
);

const CajaConEtiqueta = () => {
  const { paso, escaneando, repetir, reducir } = useSecuencia();

  return (
    <div className="relative">
      {/* La caja: grafito con la cinta del logo. */}
      <div className="relative overflow-hidden rounded-[10px] bg-[var(--grafito)] px-5 pb-6 pt-8 sm:px-10 sm:pb-10 sm:pt-12">
        <div className="absolute inset-y-0 left-[58%] w-[13%] bg-[var(--cinta)]" aria-hidden="true" />

        <motion.div
          className="relative mx-auto w-full max-w-[400px] rounded-[6px] bg-[var(--etiqueta)] text-[var(--grafito)] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]"
          initial={reducir ? false : { opacity: 0, y: 24, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -1.2 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div className="flex items-baseline justify-between border-b-2 border-[var(--grafito)] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold text-[var(--tinta-2)]">Envío</p>
              <p className="titulo cifra text-[30px]">4419 2207 18</p>
            </div>
            <p className="text-[11px] font-semibold text-[var(--tinta-2)]">Ejemplo</p>
          </div>

          <div className="grid grid-cols-[112px_1fr] gap-4 px-4 py-4">
            <div className="relative aspect-square overflow-hidden">
              <QR />
              {escaneando && (
                <motion.span
                  className="absolute inset-x-[-6%] h-[3px] bg-[var(--cinta)] shadow-[0_0_14px_3px_rgba(242,180,0,0.7)]"
                  initial={{ top: '0%' }}
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 0.95, ease: 'easeInOut' }}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="min-w-0 text-[14px] leading-snug">
              <p className="text-[11px] font-semibold text-[var(--tinta-2)]">Destinatario</p>
              <p className="font-semibold">Ana García</p>
              <p>Av. Rivadavia 5100</p>
              <p>Caballito, CABA</p>
              <p className="cifra">CP 1406</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-b-[6px] bg-[var(--grafito)] px-4 py-2.5 text-white">
            <span className="titulo text-[24px]">Zona 2</span>
            <span className="text-[13px] text-white/70">Caballito</span>
          </div>
        </motion.div>
      </div>

      {/* El seguimiento, fuera de la caja: es lo que ve la empresa en el panel. */}
      <div className="relative -mt-4 ml-auto w-[88%] rounded-[10px] border border-[var(--linea)] bg-white px-5 py-5 sm:-mt-8 sm:w-[76%] sm:px-6">
        <Seguimiento paso={paso} />
        {!reducir && (
          <button
            type="button"
            onClick={repetir}
            disabled={paso < 3}
            className="mt-4 text-sm font-semibold text-[var(--grafito)] underline underline-offset-4 disabled:invisible"
          >
            Ver de nuevo
          </button>
        )}
      </div>
    </div>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────

const BOTON_PRINCIPAL =
  'inline-flex items-center justify-center rounded-[8px] bg-[var(--cinta)] px-6 py-3.5 text-[16px] font-semibold text-[var(--grafito)] transition-colors hover:bg-[#ffc21a]';
const BOTON_SECUNDARIO =
  'inline-flex items-center justify-center rounded-[8px] px-2 py-3.5 text-[16px] font-semibold text-[var(--grafito)] underline underline-offset-4 decoration-[var(--linea)] hover:decoration-[var(--grafito)]';

const Landing = () => {
  const anio = new Date().getFullYear();

  return (
    <div className="landing min-h-screen">
      {/* Encabezado */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-5 sm:px-10">
        <Link to="/" aria-label="PacKen, inicio">
          <Logo className="h-7 sm:h-8" />
        </Link>
        <nav className="flex items-center gap-6 text-[15px] font-medium">
          <a href="#recorrido" className="hidden text-[var(--tinta-2)] hover:text-[var(--grafito)] md:inline">
            Cómo funciona
          </a>
          <a href="#preguntas" className="hidden text-[var(--tinta-2)] hover:text-[var(--grafito)] md:inline">
            Preguntas
          </a>
          <Link to="/login" className="font-semibold">
            Iniciar sesión
          </Link>
          <Link
            to="/registro"
            className="hidden rounded-[8px] bg-[var(--grafito)] px-4 py-2 font-semibold text-white hover:bg-black sm:inline-flex"
          >
            Registrar empresa
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-20 pt-8 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-14">
          <div>
            <h1 className="titulo text-[clamp(46px,7.2vw,96px)]">
              Cada envío de Mercado Libre que repartís, de la colecta a la entrega.
            </h1>
            <p className="texto mt-7 text-[18px]">
              PacKen ordena los paquetes por zona, sabe en qué estado está cada uno y te calcula cuánto cobrarle a cada
              seller y cuánto pagarle a cada transportista. Para empresas con flota propia.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link to="/registro" className={BOTON_PRINCIPAL}>
                Registrar empresa
              </Link>
              <a href="#recorrido" className={BOTON_SECUNDARIO}>
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-5 text-sm text-[var(--tinta-2)]">Gratis, sin tarjeta y sin instalar nada.</p>
          </div>

          <CajaConEtiqueta />
        </section>

        {/* Recorrido de un paquete */}
        <section id="recorrido" className="bg-white">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 lg:py-28">
            <h2 className="titulo max-w-[16ch] text-[clamp(36px,4.6vw,60px)]">El recorrido de un paquete en PacKen</h2>
            <p className="texto mt-5">
              Cada paso lo hace quien corresponde: el transportista escanea, Mercado Libre informa la entrega y la
              empresa cierra el período.
            </p>

            <ol className="mt-14 grid gap-10 lg:grid-cols-4 lg:gap-0">
              {RECORRIDO.map((r, i) => (
                <li key={r.etapa} className="relative pl-8 lg:pl-0 lg:pr-8 lg:pt-10">
                  {/* La línea de seguimiento: vertical en el celular, horizontal en pantallas grandes. */}
                  <span
                    className="absolute left-[7px] top-2 h-full w-[2px] bg-[var(--linea)] lg:left-0 lg:top-[7px] lg:h-[2px] lg:w-full"
                    aria-hidden="true"
                  />
                  <span
                    className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-[var(--grafito)] lg:top-0 ${
                      i === RECORRIDO.length - 1 ? 'bg-[var(--cinta)]' : 'bg-white'
                    }`}
                    aria-hidden="true"
                  />
                  <h3 className="titulo text-[32px]">{r.etapa}</h3>
                  <p className="mt-1 text-sm font-semibold text-[var(--grafito)]">{r.quien}</p>
                  <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--tinta-2)]">{r.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Panel y celular */}
        <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 lg:py-28">
          <h2 className="titulo max-w-[18ch] text-[clamp(36px,4.6vw,60px)]">
            Un panel para la empresa, el celular para la calle
          </h2>
          <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
            {[
              { titulo: 'En el panel de la empresa', items: EN_EL_PANEL },
              { titulo: 'En el celular del transportista', items: EN_EL_CELULAR },
            ].map((col) => (
              <div key={col.titulo}>
                <h3 className="border-b-2 border-[var(--grafito)] pb-3 text-[19px] font-semibold">{col.titulo}</h3>
                <ul>
                  {col.items.map((item) => (
                    <li key={item} className="border-b border-[var(--linea)] py-4 text-[16.5px] leading-snug">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="bg-white">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
            <h2 className="titulo text-[clamp(36px,4.6vw,60px)]">Preguntas frecuentes</h2>
            <div className="border-t-2 border-[var(--grafito)]">
              {PREGUNTAS.map((p) => (
                <details key={p.q} className="group border-b border-[var(--linea)]">
                  <summary className="flex items-center justify-between gap-6 py-5 text-[18px] font-semibold">
                    {p.q}
                    <span className="signo text-[26px] font-normal leading-none" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="texto pb-6 pr-10">{p.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Cierre */}
        <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-10 lg:py-28">
          <div className="relative overflow-hidden rounded-[10px] bg-[var(--grafito)] px-6 py-14 text-white sm:px-14 sm:py-20">
            <div className="absolute inset-y-0 right-[12%] hidden w-[9%] bg-[var(--cinta)] md:block" aria-hidden="true" />
            <div className="relative max-w-[640px]">
              <h2 className="titulo text-[clamp(38px,5vw,66px)]">Registrá tu empresa y escaneá el primer paquete hoy.</h2>
              <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-white/75">
                Conectás a tus sellers, creás las cuentas de tus transportistas y empezás a repartir con todo en un solo
                lugar.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link to="/registro" className={BOTON_PRINCIPAL}>
                  Registrar empresa
                </Link>
                <Link to="/login" className="font-semibold text-white underline underline-offset-4">
                  Ya tengo cuenta
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie */}
      <footer className="border-t border-[var(--linea)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-10 px-5 py-12 sm:px-10">
          <div className="max-w-[300px]">
            <Logo className="h-7" />
            <p className="mt-4 text-sm leading-relaxed text-[var(--tinta-2)]">
              Gestión de envíos para empresas que reparten paquetes de Mercado Libre.
            </p>
          </div>
          <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-16 gap-y-8 text-[15px]">
            <div className="flex flex-col gap-2.5">
              <Link to="/registro">Registrar empresa</Link>
              <Link to="/login">Iniciar sesión</Link>
              {!esMarcador(DATOS_LEGALES.emailContacto) && (
                <a href={`mailto:${DATOS_LEGALES.emailContacto}`}>Contacto</a>
              )}
            </div>
            <div className="flex flex-col gap-2.5">
              <Link to="/terminos">Términos y condiciones</Link>
              <Link to="/privacidad">Política de privacidad</Link>
              <Link to="/cookies">Política de cookies</Link>
            </div>
          </nav>
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-5 pb-10 text-[13.5px] text-[var(--tinta-2)] sm:px-10">
          <span>
            © {anio} {DATOS_LEGALES.razonSocial}, CUIT {DATOS_LEGALES.cuit}
          </span>
          <span>PacKen no está afiliado ni respaldado por Mercado Libre.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
