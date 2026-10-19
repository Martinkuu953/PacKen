import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { DATOS_LEGALES, esMarcador } from '../legal/datosLegales';

// Marco común de Términos, Privacidad y Cookies: pública, sin sesión, legible
// en el celular y fácil de imprimir.

// Un dato del titular. Si todavía es un marcador se resalta para que se note.
export const Dato = ({ campo }) => {
  const valor = DATOS_LEGALES[campo];
  if (esMarcador(valor)) {
    return <mark className="bg-amber-100 text-amber-900 px-1 rounded">{valor}</mark>;
  }
  return <>{valor}</>;
};

export const EmailDato = ({ campo }) => {
  const valor = DATOS_LEGALES[campo];
  if (esMarcador(valor)) return <Dato campo={campo} />;
  return (
    <a href={`mailto:${valor}`} className="text-yellow-700 underline">
      {valor}
    </a>
  );
};

export const Seccion = ({ titulo, children }) => (
  <section className="mt-8">
    <h2 className="text-lg font-bold text-gray-900 mb-2">{titulo}</h2>
    <div className="space-y-3 text-[15px] leading-relaxed text-gray-700">{children}</div>
  </section>
);

const ENLACES = [
  { to: '/terminos', label: 'Términos y condiciones' },
  { to: '/privacidad', label: 'Política de privacidad' },
  { to: '/cookies', label: 'Política de cookies' },
];

const PaginaLegal = ({ titulo, children }) => {
  useEffect(() => {
    document.title = `${titulo} · PacKen`;
    window.scrollTo(0, 0);
    return () => {
      document.title = 'PacKen';
    };
  }, [titulo]);

  return (
    <div className="min-h-screen bg-marca-crema">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Volver al inicio">
            <Logo className="h-7" />
          </Link>
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <article className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{titulo}</h1>
          <p className="mt-2 text-sm text-gray-500">
            Vigente desde el {DATOS_LEGALES.vigenciaDesde} · Versión {DATOS_LEGALES.version}
          </p>
          {children}
        </article>

        <nav aria-label="Documentos legales" className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {ENLACES.map((e) => (
            <Link key={e.to} to={e.to} className="text-gray-600 hover:text-gray-900 underline">
              {e.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
};

export default PaginaLegal;
