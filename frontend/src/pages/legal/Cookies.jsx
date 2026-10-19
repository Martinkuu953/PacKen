import PaginaLegal, { EmailDato, Seccion } from '../../components/PaginaLegal';

// Lo que se describe acá tiene que coincidir con lo que la app realmente
// guarda: si se agrega una cookie o un script de terceros (analytics, chat,
// píxeles), hay que sumarlo a la tabla y, si no es necesario, pedir
// consentimiento antes de cargarlo.
const ALMACENAMIENTO = [
  {
    nombre: 'packen_refresh',
    tipo: 'Cookie propia (httpOnly, segura)',
    finalidad: 'Mantener la sesión iniciada de forma segura. Solo se envía al iniciar o renovar la sesión.',
    duracion: 'Hasta 30 días o hasta cerrar sesión',
  },
  {
    nombre: 'packen_asistente:*',
    tipo: 'Almacenamiento de sesión del navegador',
    finalidad: 'Recordar la conversación con el asistente mientras navegás entre pantallas.',
    duracion: 'Hasta cerrar la pestaña o cerrar sesión',
  },
  {
    nombre: 'packen_aviso_cookies',
    tipo: 'Almacenamiento local del navegador',
    finalidad: 'Recordar que ya viste el aviso de cookies, para no mostrarlo de nuevo.',
    duracion: 'Hasta que borres los datos del navegador',
  },
];

const Cookies = () => (
  <PaginaLegal titulo="Política de cookies">
    <p className="mt-6 text-[15px] leading-relaxed text-gray-700">
      Las cookies y el almacenamiento del navegador son pequeños datos que un sitio guarda en tu dispositivo. PacKen
      usa <strong>solo los estrictamente necesarios</strong> para funcionar.
    </p>

    <Seccion titulo="Qué usamos">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2 border-b border-gray-200">Nombre</th>
              <th className="p-2 border-b border-gray-200">Tipo</th>
              <th className="p-2 border-b border-gray-200">Para qué</th>
              <th className="p-2 border-b border-gray-200">Duración</th>
            </tr>
          </thead>
          <tbody>
            {ALMACENAMIENTO.map((c) => (
              <tr key={c.nombre} className="align-top">
                <td className="p-2 border-b border-gray-100 font-mono text-xs">{c.nombre}</td>
                <td className="p-2 border-b border-gray-100">{c.tipo}</td>
                <td className="p-2 border-b border-gray-100">{c.finalidad}</td>
                <td className="p-2 border-b border-gray-100">{c.duracion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>

    <Seccion titulo="Qué no usamos">
      <p>
        No usamos cookies de publicidad, de seguimiento ni de analítica, y no cargamos scripts de terceros que las
        instalen. Las tipografías del sitio se sirven desde nuestros propios servidores, sin conexiones a terceros.
      </p>
    </Seccion>

    <Seccion titulo="Cómo controlarlas">
      <p>
        Podés borrar o bloquear las cookies desde la configuración de tu navegador. Si bloqueás la cookie de sesión no
        vas a poder mantener la sesión iniciada en PacKen.
      </p>
    </Seccion>

    <Seccion titulo="Consultas">
      <p>
        Escribinos a <EmailDato campo="emailPrivacidad" />.
      </p>
    </Seccion>
  </PaginaLegal>
);

export default Cookies;
