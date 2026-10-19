import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
// Tipografías servidas desde el propio sitio (no desde Google Fonts): así no se
// manda la IP de cada visitante a un tercero, y la política de cookies puede
// decir con verdad que no hay conexiones a terceros.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import Logo from '../components/Logo';
import { DATOS_LEGALES, esMarcador } from '../legal/datosLegales';

const FONT_DISPLAY = "'Space Grotesk', sans-serif";
const FONT_SERIF = "'Instrument Serif', serif";

// Todo lo que se afirma acá tiene que existir en la app. Nada de cifras,
// clientes ni testimonios que no sean reales y comprobables: es publicidad
// engañosa (Ley 24.240 art. 9, Ley 22.802).
const FEATURES = [
  { title: 'Envíos centralizados', body: 'Todos los envíos de Mercado Libre que reparte tu empresa en un solo panel, con filtros por seller, transportista, estado y fecha.' },
  { title: 'Escaneo desde el celular', body: 'El transportista escanea el QR de la etiqueta en la colecta o el reparto y el envío se carga solo, con los datos del comprador.' },
  { title: 'Estados al día', body: 'El estado de cada envío se actualiza automáticamente con lo que informa Mercado Libre. Cada cambio queda en el historial del paquete.' },
  { title: 'Cobros y pagos ordenados', body: 'Listas de precios y costos por zona para calcular lo que cobrás a cada seller y lo que pagás a cada transportista, exportable a Excel.' },
];

const STEPS = [
  { num: '01', title: 'Conectá a tus sellers', body: 'Cada vendedor autoriza a PacKen desde su cuenta de Mercado Libre. A partir de ahí, sus envíos se sincronizan solos.' },
  { num: '02', title: 'Escaneá los paquetes', body: 'Tus transportistas escanean las etiquetas desde el celular en la colecta y en el reparto. Cada uno ve solo lo suyo.' },
  { num: '03', title: 'Controlá y liquidá', body: 'Seguí el estado de cada envío, reasigná cuando haga falta y generá los resúmenes de cobro y pago del período.' },
];

const PAIN_POINTS = [
  'Cada envío se carga a una planilla a mano',
  'La asignación a los repartidores se coordina por WhatsApp suelto',
  'Nadie sabe dónde está un paquete hasta que llama a preguntar',
  'Los reclamos se resuelven a fuerza de llamadas',
];

const GAIN_POINTS = [
  'Todos los envíos en un solo panel',
  'Cada transportista ve y escanea sus paquetes desde el celular',
  'El estado de cada paquete se actualiza solo, desde Mercado Libre',
  'Estadísticas por partido y resúmenes de cobro y pago en Excel',
];

const FAQS = [
  { q: '¿Para quién es PacKen?', a: 'Para empresas de logística que reparten envíos de Mercado Libre (por ejemplo, Flex) con su propia flota. No está pensado para vendedores individuales.' },
  { q: '¿Necesito instalar algo?', a: 'No. El panel funciona desde el navegador y los transportistas usan PacKen desde el celular, sin instalar ninguna aplicación.' },
  { q: '¿Cómo entran los envíos a PacKen?', a: 'Conectás las cuentas de Mercado Libre de tus sellers y tus transportistas escanean el QR de cada etiqueta. Los estados se actualizan solos con la información de Mercado Libre.' },
  { q: '¿Las “facturas” sirven como comprobante fiscal?', a: 'No. Son resúmenes internos para saber cuánto cobrarle a cada seller y cuánto pagarle a cada transportista. Las facturas fiscales las seguís emitiendo vos ante ARCA.' },
  { q: '¿Cuánto cuesta?', a: 'Hoy el registro y el uso son gratuitos. Si en el futuro hay planes pagos, se avisará con anticipación y no se cobrará nada sin que lo aceptes.' },
  { q: '¿Qué pasa con los datos de los compradores?', a: 'Se usan solo para gestionar las entregas. No se venden ni se usan para publicidad. Más detalle en la Política de privacidad.' },
];

// Ejemplos ilustrativos de la interfaz (se aclara en pantalla).
const TABS_DATA = [
  {
    label: 'Envíos', hint: 'Todo en un lugar',
    title: 'Todos los envíos, en un solo panel',
    desc: 'Filtrá por seller, transportista, estado o fecha y buscá cualquier envío por ID, comprador o dirección.',
    rows: [
      { tag: 'ML', label: 'Palermo · Av. Santa Fe 3200', meta: 'Sin asignar', badge: 'Ingresado', tone: 'amber' },
      { tag: 'ML', label: 'Caballito · Rivadavia 5100', meta: 'Asignado a J. Pérez', badge: 'En camino', tone: 'green' },
      { tag: 'ML', label: 'Belgrano · Cabildo 1800', meta: 'Asignado a L. Méndez', badge: 'Entregado', tone: 'gray' },
    ],
  },
  {
    label: 'Zonas', hint: 'Barrios de Flex',
    title: 'Cada barrio, en su zona',
    desc: 'Asigná los barrios de Flex a tus zonas. La zona define cuánto cobrás y cuánto pagás por cada envío.',
    rows: [
      { tag: '1', label: 'Zona 1', meta: 'Palermo, Belgrano, Núñez', badge: 'Tarifa A', tone: 'gray' },
      { tag: '2', label: 'Zona 2', meta: 'Caballito, Flores, Almagro', badge: 'Tarifa B', tone: 'gray' },
      { tag: '3', label: 'Zona 3', meta: 'Avellaneda, Lanús, Quilmes', badge: 'Tarifa C', tone: 'gray' },
    ],
  },
  {
    label: 'Transportistas', hint: 'Tu flota',
    title: 'Tu flota, con sus paquetes',
    desc: 'Cada transportista ve sus envíos en el celular. Vos ves cuántos tiene en camino, entregados y cancelados.',
    rows: [
      { tag: 'JP', label: 'Juan Pérez', meta: '12 de 18 entregados', badge: 'En camino', tone: 'green' },
      { tag: 'LM', label: 'Lucía Méndez', meta: '9 de 9 entregados', badge: 'Completo', tone: 'gray' },
      { tag: 'RG', label: 'Ramiro Gómez', meta: '5 de 14 entregados', badge: 'En camino', tone: 'green' },
    ],
  },
  {
    label: 'Cobros', hint: 'Facturas y liquidaciones',
    title: 'Cuánto cobrás y cuánto pagás',
    desc: 'Resúmenes por período para cada seller y cada transportista, calculados con tus listas de precios y costos.',
    rows: [
      { tag: '$', label: 'Resumen a seller', meta: 'Entregados del período', badge: 'Excel', tone: 'green' },
      { tag: '$', label: 'Liquidación a transportista', meta: 'Entregados del período', badge: 'Excel', tone: 'green' },
      { tag: '#', label: 'Estadísticas por partido', meta: 'Por estado', badge: 'Excel', tone: 'gray' },
    ],
  },
];

const BADGE_TONE = {
  green: 'bg-[#E9FBE9] text-[#1E7A3B]',
  amber: 'bg-[#FFF3CC] text-[#8A6A00]',
  gray: 'bg-[#F0EEE4] text-[#6B6852]',
};

const HERO_WORDS = [
  'Toda', 'tu', 'operación', 'de', 'reparto,',
];

const CARD_TRANSITION = 'transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)]';

function useRevealObserver(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('.reveal, .reveal-pop');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [containerRef]);
}

function ScrollProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? Math.min(1, doc.scrollTop / scrollable) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${pct})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 z-[100] h-[3px] w-full origin-left scale-x-0 bg-gradient-to-r from-[#FFDE00] to-[#F5C400]"
    />
  );
}

function useLiveDashboard() {
  const [entregados, setEntregados] = useState(128);
  const [porEntregar, setPorEntregar] = useState(37);

  useEffect(() => {
    const id = setInterval(() => {
      setEntregados((e) => e + 1);
      setPorEntregar((p) => (p <= 14 ? 37 : p - 1));
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return { entregados, porEntregar };
}

const Landing = () => {
  const containerRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const { entregados, porEntregar } = useLiveDashboard();

  useRevealObserver(containerRef);

  const tab = TABS_DATA[activeTab];

  return (
    <div
      ref={containerRef}
      className="pk-landing max-w-full overflow-x-hidden bg-[#FBFBF8] text-[#16150F]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <ScrollProgress />

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[#EDEBE2] bg-[#FBFBF8]/82 px-5 py-4 backdrop-blur-md sm:px-10">
        <Logo className="h-[30px]" />
        <div className="hidden items-center gap-8 md:flex">
          <a href="#funciones" className="text-[15px] font-medium text-[#4A4838]">Funciones</a>
          <a href="#como" className="text-[15px] font-medium text-[#4A4838]">Cómo funciona</a>
          <a href="#faq" className="text-[15px] font-medium text-[#4A4838]">Preguntas</a>
        </div>
        <div className="flex items-center gap-3.5">
          <Link to="/login" className="text-[15px] font-semibold text-[#16150F]">Iniciar sesión</Link>
          <Link
            to="/registro"
            className="rounded-[10px] bg-[#FFDE00] px-[18px] py-2.5 text-[15px] font-semibold text-[#16150F]"
          >
            Registrarse
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative mx-auto max-w-[1180px] px-5 pb-10 pt-16 text-center sm:px-10 sm:pt-[88px]">
        <div
          className="glow pointer-events-none absolute left-[12%] top-10 z-0 h-[340px] w-[340px] rounded-full blur-[30px] [animation:glowFloat_11s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle, rgba(255,222,0,0.55), rgba(255,222,0,0))' }}
        />
        <div
          className="glow pointer-events-none absolute right-[10%] top-[120px] z-0 h-[300px] w-[300px] rounded-full blur-[34px] [animation:glowFloat2_14s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle, rgba(255,240,140,0.5), rgba(255,240,140,0))' }}
        />

        <div
          className="hero-chip pointer-events-none absolute left-10 top-[340px] z-0 hidden items-center gap-2 rounded-[13px] border border-[#EDEBE2] bg-white px-[15px] py-[11px] shadow-[0_20px_40px_-24px_rgba(22,21,15,0.4)] [animation:floatChip_7s_ease-in-out_infinite] min-[1121px]:flex"
          style={{ '--r': '-7deg', transform: 'rotate(-7deg)' }}
        >
          <span className="h-[9px] w-[9px] rounded-full bg-[#1E7A3B] [animation:livePulse_1.8s_ease-out_infinite]" />
          <span className="text-[13.5px] font-semibold" style={{ fontFamily: FONT_DISPLAY }}>#FLX-8842 · En camino</span>
        </div>
        <div
          className="hero-chip pointer-events-none absolute right-10 top-[300px] z-0 hidden items-center gap-2 rounded-[13px] bg-[#16150F] px-[15px] py-[11px] text-[#F6F5EE] shadow-[0_20px_40px_-24px_rgba(22,21,15,0.5)] [animation:floatChip_8.5s_ease-in-out_infinite_0.6s] min-[1121px]:flex"
          style={{ '--r': '6deg', transform: 'rotate(6deg)' }}
        >
          <span className="h-4 w-4 rounded-[5px] bg-[#FFDE00]" />
          <span className="text-[13.5px] font-semibold" style={{ fontFamily: FONT_DISPLAY }}>Asignado a J. Pérez</span>
        </div>
        <div
          className="hero-chip pointer-events-none absolute right-14 top-[410px] z-0 hidden items-center gap-2 rounded-[13px] bg-[#FFDE00] px-3.5 py-[9px] shadow-[0_16px_34px_-20px_rgba(22,21,15,0.4)] [animation:floatChip_9s_ease-in-out_infinite_1.2s] min-[1121px]:flex"
          style={{ '--r': '4deg', transform: 'rotate(4deg)' }}
        >
          <span className="text-[13.5px] font-bold text-[#16150F]" style={{ fontFamily: FONT_DISPLAY }}>128 entregas hoy</span>
        </div>

        <div className="relative z-[1] [animation:floatUp_0.7s_ease_both]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#E6E3D6] bg-white px-3.5 py-[7px] text-[13px] font-semibold text-[#6B6852]">
            <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#16150F] [animation:softPulse_2.4s_ease-in-out_infinite]" />
            Para empresas de logística de Mercado Libre
          </div>
          <h1
            className="mx-auto max-w-[900px] text-[clamp(40px,6.4vw,74px)] font-bold leading-[1.02] tracking-[-0.03em]"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            {HERO_WORDS.map((w, i) => (
              <span key={w} className="word" style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
                {w}{' '}
              </span>
            ))}
            <br />
            <span className="word" style={{ animationDelay: '0.36s' }}>
              <span
                className="shimmer-text bg-clip-text italic tracking-[-0.01em] text-transparent [animation:shimmer_5s_linear_infinite] [background-size:200%_auto]"
                style={{
                  fontFamily: FONT_SERIF,
                  fontWeight: 400,
                  backgroundImage: 'linear-gradient(100deg,#B0862E,#16150F,#B0862E)',
                }}
              >
                al fin
              </span>
            </span>{' '}
            <span className="word" style={{ animationDelay: '0.44s' }}>bajo</span>{' '}
            <span className="word" style={{ animationDelay: '0.52s' }}>control.</span>
          </h1>
          <p className="mx-auto mt-6.5 max-w-[600px] text-[clamp(17px,2vw,21px)] font-[450] leading-[1.5] text-[#54513F]">
            PacKen centraliza los envíos de Mercado Libre que reparte tu empresa, los ordena por zona y mantiene
            al día el estado de cada paquete.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3.5">
            <Link
              to="/registro"
              className="rounded-xl bg-[#16150F] px-7 py-[15px] text-[16px] font-semibold text-white transition-[transform,box-shadow] duration-[250ms] ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_30px_-14px_rgba(22,21,15,0.6)]"
            >
              Registrarse
            </Link>
            <a
              href="#como"
              className="rounded-xl border border-[#E1DED0] bg-white px-7 py-[15px] text-[16px] font-semibold text-[#16150F] transition-[transform,border-color] duration-[250ms] ease-out hover:-translate-y-[3px] hover:border-[#FFDE00]"
            >
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-[18px] text-[13.5px] text-[#8A8770]">
            Pensado para flotas de reparto, no para vendedores individuales
          </p>
        </div>
      </header>

      {/* HERO DASHBOARD MOCK */}
      <section className="reveal-pop mx-auto mt-11 max-w-[1080px] px-5 sm:px-10">
        <div className="overflow-hidden rounded-[20px] border border-[#E6E3D6] bg-white shadow-[0_40px_80px_-40px_rgba(22,21,15,0.25)]">
          <div className="flex items-center gap-2 border-b border-[#EFEDE3] bg-[#FCFCF9] px-[18px] py-3.5">
            <div className="flex gap-1.5">
              <span className="h-[11px] w-[11px] rounded-full bg-[#E6E3D6]" />
              <span className="h-[11px] w-[11px] rounded-full bg-[#E6E3D6]" />
              <span className="h-[11px] w-[11px] rounded-full bg-[#E6E3D6]" />
            </div>
            <div className="ml-3 text-[13px] text-[#9A9780]" style={{ fontFamily: FONT_DISPLAY }}>
              PacKen · Panel
            </div>
          </div>
          <div className="grid min-h-[400px] grid-cols-1 sm:grid-cols-[200px_1fr]">
            <aside className="hidden border-r border-[#EFEDE3] bg-[#FCFCF9] px-4 py-[22px] sm:block">
              <div className="mb-3.5 text-[11px] font-bold tracking-[0.08em] text-[#B0AD95]">PANEL</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5 rounded-[9px] bg-[#FFDE00] px-[11px] py-[9px] text-[14px] font-semibold">
                  <span className="h-2 w-2 rounded-[2px] bg-[#16150F]" />
                  Paquetes
                </div>
                {['Zonas', 'Transportistas', 'Estadísticas'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 rounded-[9px] px-[11px] py-[9px] text-[14px] text-[#54513F]">
                    <span className="h-2 w-2 rounded-[2px] bg-[#D8D5C4]" />
                    {item}
                  </div>
                ))}
              </div>
            </aside>
            <div className="p-6">
              <div className="mb-5 flex flex-wrap gap-3.5">
                <div className="min-w-[120px] flex-1 rounded-[13px] border border-[#EFEDE3] p-[15px]">
                  <div className="text-[12.5px] text-[#8A8770]">Por entregar</div>
                  <div className="mt-1 text-[28px] font-bold" style={{ fontFamily: FONT_DISPLAY }}>
                    {porEntregar}
                  </div>
                </div>
                <div className="min-w-[120px] flex-1 rounded-[13px] border border-[#EFEDE3] p-[15px]">
                  <div className="text-[12.5px] text-[#8A8770]">Entregados hoy</div>
                  <div
                    key={entregados}
                    className="mt-1 text-[28px] font-bold [animation:tick_0.5s_ease]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    {entregados}
                  </div>
                </div>
                <div className="min-w-[120px] flex-1 rounded-[13px] border border-[#EFEDE3] bg-[#FFF9CC] p-[15px]">
                  <div className="text-[12.5px] text-[#8A8770]">Sin asignar</div>
                  <div className="mt-1 text-[28px] font-bold" style={{ fontFamily: FONT_DISPLAY }}>4</div>
                </div>
              </div>
              <div className="overflow-hidden rounded-[13px] border border-[#EFEDE3]">
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr] border-b border-[#EFEDE3] bg-[#FCFCF9] px-4 py-[11px] text-[11.5px] font-bold tracking-[0.04em] text-[#B0AD95]">
                  <span>PAQUETE</span><span>ZONA</span><span>ESTADO</span>
                </div>
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr] items-center border-b border-[#F2F1E8] px-4 py-[13px] text-[14px]">
                  <span className="font-semibold">#FLX-8842</span>
                  <span className="text-[#54513F]">Palermo</span>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#E9FBE9] px-[9px] py-1 text-[12px] font-semibold text-[#1E7A3B]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1E7A3B] [animation:livePulse_1.8s_ease-out_infinite]" />
                    En camino
                  </span>
                </div>
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr] items-center border-b border-[#F2F1E8] px-4 py-[13px] text-[14px]">
                  <span className="font-semibold">#FLX-8843</span>
                  <span className="text-[#54513F]">Caballito</span>
                  <span className="w-fit rounded-full bg-[#FFF3CC] px-[9px] py-1 text-[12px] font-semibold text-[#8A6A00]">Ingresado</span>
                </div>
                <div className="grid grid-cols-[1.4fr_1fr_0.9fr] items-center px-4 py-[13px] text-[14px]">
                  <span className="font-semibold">#FLX-8844</span>
                  <span className="text-[#54513F]">Belgrano</span>
                  <span className="w-fit rounded-full bg-[#E9FBE9] px-[9px] py-1 text-[12px] font-semibold text-[#1E7A3B]">Entregado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="mx-auto mt-3 max-w-[1080px] px-5 text-center text-[12.5px] text-[#9A9780] sm:px-10">
        Imagen ilustrativa con datos de ejemplo.
      </p>

      {/* FEATURES */}
      <section id="funciones" className="mx-auto mt-[120px] max-w-[1180px] px-5 sm:px-10">
        <div className="mb-[52px] max-w-[640px]">
          <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B0862E]">Funciones</p>
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-[1.06] tracking-[-0.025em]" style={{ fontFamily: FONT_DISPLAY }}>
            Todo lo que tu operación de reparto necesita, en un solo lugar.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`reveal-pop rounded-[18px] border border-[#E9E6DA] bg-white p-7 ${CARD_TRANSITION} hover:-translate-y-1.5 hover:border-[#FFDE00] hover:shadow-[0_22px_40px_-26px_rgba(22,21,15,0.35)]`}
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#FFF3B0]">
                <div className="h-[18px] w-[18px] rounded-[5px] bg-[#16150F]" />
              </div>
              <h3 className="mb-2 text-[19px] font-semibold tracking-[-0.01em]" style={{ fontFamily: FONT_DISPLAY }}>
                {f.title}
              </h3>
              <p className="text-[14.5px] leading-[1.55] text-[#57543F]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE SHOWCASE */}
      <section className="mx-auto mt-[120px] max-w-[1180px] px-5 sm:px-10">
        <div className="mb-11 max-w-[640px]">
          <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B0862E]">En acción</p>
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-[1.06] tracking-[-0.025em]" style={{ fontFamily: FONT_DISPLAY }}>
            Tocá y mirá PacKen por dentro.
          </h2>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(220px,300px)_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS_DATA.map((tb, i) => (
              <button
                key={tb.label}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`flex flex-shrink-0 flex-col gap-0.5 rounded-[14px] px-[18px] py-4 text-left transition-all duration-200 ${
                  activeTab === i
                    ? 'border border-[#16150F] bg-[#16150F] text-[#F6F5EE]'
                    : 'border border-[#E9E6DA] bg-white text-[#16150F]'
                }`}
              >
                <span className="text-[16px] font-semibold" style={{ fontFamily: FONT_DISPLAY }}>{tb.label}</span>
                <span className="text-[13px] opacity-70">{tb.hint}</span>
              </button>
            ))}
          </div>
          <div className="min-h-[360px] rounded-[20px] border border-[#E9E6DA] bg-white p-6 shadow-[0_30px_60px_-44px_rgba(22,21,15,0.4)] sm:p-9">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="h-[9px] w-[9px] rounded-[3px] bg-[#FFDE00]" />
              <h3 className="text-[22px] font-bold tracking-[-0.01em]" style={{ fontFamily: FONT_DISPLAY }}>{tab.title}</h3>
            </div>
            <p className="mb-6.5 max-w-[520px] text-[15px] leading-[1.55] text-[#57543F]">{tab.desc}</p>
            <div className="flex flex-col gap-2.5">
              {tab.rows.map((r) => (
                <div
                  key={r.tag + r.label}
                  className="flex items-center justify-between gap-4 rounded-[13px] border border-[#EFEDE3] bg-[#FCFCF9] px-[18px] py-[15px] [animation:floatUp_0.45s_ease_both]"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#FFF3B0] text-[13px] font-bold text-[#16150F]"
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      {r.tag}
                    </span>
                    <div>
                      <div className="text-[14.5px] font-semibold">{r.label}</div>
                      <div className="text-[13px] text-[#8A8770]">{r.meta}</div>
                    </div>
                  </div>
                  <span className={`w-fit whitespace-nowrap rounded-full px-[11px] py-[5px] text-[12px] font-semibold ${BADGE_TONE[r.tone]}`}>
                    {r.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como" className="mt-[120px] bg-[#16150F] px-5 py-20 text-[#F6F5EE] sm:px-10">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-14 max-w-[620px]">
            <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#FFDE00]">Cómo funciona</p>
            <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-[1.06] tracking-[-0.025em]" style={{ fontFamily: FONT_DISPLAY }}>
              Listo en tres pasos. Sin planillas.
            </h2>
          </div>
          <div className="relative mb-5 hidden h-[52px] sm:block">
            <div className="absolute left-[2%] right-[2%] top-1/2 h-0 border-t border-dashed border-[1.5px] border-[#35342A]" />
            <div className="absolute top-1/2 left-[16.6%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFDE00]" />
            <div className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFDE00]" />
            <div className="absolute top-1/2 left-[83.3%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FFDE00]" />
            <div
              className="route-runner absolute top-1/2 flex h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[7px] bg-[#FFDE00] shadow-[0_8px_20px_-5px_rgba(255,222,0,0.75)] [animation:moveX_5.5s_ease-in-out_infinite_alternate]"
            >
              <span className="h-[11px] w-[11px] rounded-[2px] bg-[#16150F]" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="reveal border-t border-[#35342A] pt-6.5">
                <div className="mb-5.5 text-[15px] font-bold text-[#FFDE00]" style={{ fontFamily: FONT_DISPLAY }}>{s.num}</div>
                <h3 className="mb-2.5 text-[22px] font-semibold tracking-[-0.01em]" style={{ fontFamily: FONT_DISPLAY }}>{s.title}</h3>
                <p className="text-[15px] leading-[1.55] text-[#B4B2A2]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="mx-auto mt-[120px] max-w-[1080px] px-5 sm:px-10">
        <div className="mx-auto mb-[52px] max-w-[640px] text-center">
          <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[#B0862E]">La diferencia</p>
          <h2 className="text-[clamp(30px,4vw,46px)] font-bold leading-[1.06] tracking-[-0.025em]" style={{ fontFamily: FONT_DISPLAY }}>
            El mismo día, con o sin PacKen.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="reveal rounded-[20px] border border-[#E9E6DA] bg-white p-[34px]">
            <h3 className="mb-6 text-[19px] font-semibold text-[#8A8770]" style={{ fontFamily: FONT_DISPLAY }}>
              A mano, con planilla
            </h3>
            {PAIN_POINTS.map((p) => (
              <div key={p} className="flex items-start gap-3 border-t border-[#F2F1E8] py-3.5 text-[15px] text-[#57543F]">
                <span className="mt-px flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-[#F0EEE4] text-[14px] text-[#9A9780]">
                  ✕
                </span>
                {p}
              </div>
            ))}
          </div>
          <div className="reveal rounded-[20px] border-[1.5px] border-[#16150F] bg-[#16150F] p-[34px] text-[#F6F5EE] shadow-[0_30px_60px_-38px_rgba(22,21,15,0.6)]">
            <h3 className="mb-6 flex items-center gap-2.5 text-[19px] font-semibold text-[#FFDE00]" style={{ fontFamily: FONT_DISPLAY }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-[#FFDE00]">
                <span className="h-2 w-2 rounded-[2px] bg-[#16150F]" />
              </span>
              Con PacKen
            </h3>
            {GAIN_POINTS.map((g) => (
              <div key={g} className="flex items-start gap-3 border-t border-[#35342A] py-3.5 text-[15px] text-[#EDEBDF]">
                <span className="mt-px flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-[#FFDE00] text-[13px] font-bold text-[#16150F]">
                  ✓
                </span>
                {g}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto mt-[120px] max-w-[820px] px-5 sm:px-10">
        <h2
          className="mb-12 text-center text-[clamp(30px,4vw,46px)] font-bold leading-[1.06] tracking-[-0.025em]"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          Preguntas frecuentes
        </h2>
        <div className="flex flex-col">
          {FAQS.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q} className="border-b border-[#E6E3D6]">
                <button
                  type="button"
                  onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
                  className="flex w-full items-center justify-between gap-5 px-1 py-6 text-left text-[18px] font-semibold tracking-[-0.01em] text-[#16150F]"
                  style={{ fontFamily: FONT_DISPLAY }}
                  aria-expanded={open}
                >
                  {item.q}
                  <span
                    className="flex-shrink-0 text-[26px] font-normal text-[#B0862E] transition-transform duration-200"
                    style={{ fontFamily: FONT_DISPLAY, transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
                  >
                    +
                  </span>
                </button>
                {open && (
                  <p className="max-w-[640px] px-1 pb-6.5 text-[15.5px] leading-[1.6] text-[#57543F]">{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="contacto" className="mx-auto mt-[120px] max-w-[1180px] px-5 sm:px-10">
        <div className="reveal-pop relative overflow-hidden rounded-[26px] bg-[#FFDE00] px-5 py-12 text-center sm:px-10 sm:py-[88px]">
          <div
            className="pointer-events-none absolute -left-10 -top-[60px] h-[280px] w-[280px] rounded-full blur-[20px] [animation:glowFloat_12s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
          />
          <div
            className="pointer-events-none absolute -bottom-[70px] -right-[30px] h-[260px] w-[260px] rounded-full blur-[24px] [animation:glowFloat2_15s_ease-in-out_infinite]"
            style={{ background: 'radial-gradient(circle, rgba(22,21,15,0.12), rgba(22,21,15,0))' }}
          />
          <div className="relative z-[1]">
            <h2
              className="mx-auto max-w-[720px] text-[clamp(32px,5vw,58px)] font-bold leading-[1.03] tracking-[-0.03em]"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Empezá a ordenar el reparto de tu empresa.
            </h2>
            <p className="mx-auto mt-[22px] max-w-[520px] text-[clamp(16px,2vw,19px)] leading-[1.5] text-[#4A4425]">
              Creá tu cuenta gratis y llevá todos los envíos que reparte tu flota a un solo panel, ordenados por zona.
            </p>
            <Link
              to="/registro"
              className="mt-[34px] inline-block rounded-xl bg-[#16150F] px-8 py-4 text-[16px] font-semibold text-white"
            >
              Registrarse
            </Link>
            <p className="mt-4 text-[13.5px] text-[#6B6335]">Registro gratuito. Sin tarjeta de crédito.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto mt-[100px] max-w-[1180px] border-t border-[#EDEBE2] px-5 pb-14 pt-12 sm:px-10">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="max-w-[260px]">
            <Logo className="mb-3.5 block h-7" />
            <p className="text-[14px] leading-[1.55] text-[#8A8770]">
              El gestor logístico para empresas que reparten envíos de Mercado Libre.
            </p>
          </div>
          <div className="flex flex-wrap gap-16">
            <div className="flex flex-col gap-3">
              <span className="mb-0.5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#B0AD95]">Producto</span>
              <a href="#funciones" className="text-[14.5px] text-[#57543F]">Funciones</a>
              <a href="#como" className="text-[14.5px] text-[#57543F]">Cómo funciona</a>
              <a href="#faq" className="text-[14.5px] text-[#57543F]">Preguntas</a>
            </div>
            <div className="flex flex-col gap-3">
              <span className="mb-0.5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#B0AD95]">Cuenta</span>
              <Link to="/registro" className="text-[14.5px] text-[#57543F]">Registrarse</Link>
              <Link to="/login" className="text-[14.5px] text-[#57543F]">Iniciar sesión</Link>
              {!esMarcador(DATOS_LEGALES.emailContacto) && (
                <a href={`mailto:${DATOS_LEGALES.emailContacto}`} className="text-[14.5px] text-[#57543F]">Contacto</a>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <span className="mb-0.5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#B0AD95]">Legal</span>
              <Link to="/terminos" className="text-[14.5px] text-[#57543F]">Términos y condiciones</Link>
              <Link to="/privacidad" className="text-[14.5px] text-[#57543F]">Política de privacidad</Link>
              <Link to="/cookies" className="text-[14.5px] text-[#57543F]">Política de cookies</Link>
            </div>
          </div>
        </div>
        <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-[#EDEBE2] pt-6 text-[13.5px] text-[#9A9780]">
          <span>
            © {new Date().getFullYear()} {DATOS_LEGALES.razonSocial} · CUIT {DATOS_LEGALES.cuit}
          </span>
          <span>PacKen no está afiliado ni respaldado por Mercado Libre.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
