import { Link } from 'react-router-dom';
import PaginaLegal, { Dato, EmailDato, Seccion } from '../../components/PaginaLegal';

const Privacidad = () => (
  <PaginaLegal titulo="Política de privacidad">
    <p className="mt-6 text-[15px] leading-relaxed text-gray-700">
      Esta política explica qué datos personales trata PacKen, para qué, con quién se comparten y cómo podés ejercer
      tus derechos, conforme a la Ley 25.326 de Protección de los Datos Personales y su normativa complementaria.
    </p>

    <Seccion titulo="1. Responsable">
      <p>
        <Dato campo="razonSocial" />, CUIT <Dato campo="cuit" />, domicilio en <Dato campo="domicilio" />. Consultas
        sobre privacidad: <EmailDato campo="emailPrivacidad" />.
      </p>
      <p>
        PacKen es responsable de los datos de las cuentas de Empresa. Respecto de los datos de compradores y
        Transportistas que carga cada Empresa, la responsable es esa Empresa y PacKen actúa como encargado del
        tratamiento (artículo 25 de la Ley 25.326): solo los trata para prestarle el servicio.
      </p>
    </Seccion>

    <Seccion titulo="2. Qué datos tratamos">
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Cuenta de Empresa:</strong> nombre de la empresa, email y contraseña (guardada cifrada con un hash
          irreversible; nadie, ni siquiera PacKen, puede verla), fecha de alta y la versión de estos documentos que se
          aceptó.
        </li>
        <li>
          <strong>Transportistas:</strong> nombre, email, DNI y contraseña (con hash), cargados por la Empresa.
        </li>
        <li>
          <strong>Sellers:</strong> nombre, identificador de la cuenta de Mercado Libre y las credenciales de acceso
          que otorga Mercado Libre al autorizar la conexión (guardadas cifradas).
        </li>
        <li>
          <strong>Envíos y compradores:</strong> identificador del envío, nombre del comprador, dirección, código
          postal, barrio, estado del envío y fechas, obtenidos de Mercado Libre al escanear la etiqueta o al
          sincronizar.
        </li>
        <li>
          <strong>Registro de actividad:</strong> qué usuario cambió el estado de un envío y cuándo, e intentos de
          inicio de sesión con la dirección IP, para seguridad y para prevenir accesos indebidos. Nuestros proveedores
          de hosting registran además datos técnicos de cada conexión (IP, navegador, fecha y hora).
        </li>
      </ul>
      <p>No tratamos datos sensibles ni pedimos datos de tarjetas de pago.</p>
    </Seccion>

    <Seccion titulo="3. Para qué los usamos">
      <ul className="list-disc pl-6 space-y-1">
        <li>Crear y administrar las cuentas y permitir el inicio de sesión.</li>
        <li>Prestar el servicio: registrar, asignar y seguir los envíos; calcular resúmenes y estadísticas.</li>
        <li>Mantener la seguridad de la plataforma y prevenir fraudes y accesos no autorizados.</li>
        <li>Comunicarnos con la Empresa sobre su cuenta, cambios en el servicio o en estos documentos.</li>
        <li>Cumplir obligaciones legales.</li>
      </ul>
      <p>
        No vendemos ni alquilamos datos personales, no los usamos para publicidad y no hacemos perfiles comerciales de
        los compradores.
      </p>
    </Seccion>

    <Seccion titulo="4. Base legal">
      <p>
        Tratamos los datos de la cuenta con el consentimiento que se presta al registrarse y porque son necesarios para
        prestar el servicio contratado. Los datos de compradores y Transportistas los trata la Empresa con la base
        legal que le corresponda (por ejemplo, la relación con el Seller y la entrega del envío, o la relación con el
        Transportista), y es la Empresa quien debe informar a esos titulares.
      </p>
    </Seccion>

    <Seccion titulo="5. Con quién se comparten">
      <p>Solo con los proveedores que necesitamos para funcionar, que tratan los datos por cuenta nuestra:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Supabase</strong>: base de datos donde se almacena la información.</li>
        <li><strong>Vercel</strong>: alojamiento de la aplicación y de sus servicios.</li>
        <li>
          <strong>Mercado Libre</strong>: de donde se obtienen los datos de los envíos, con la autorización del Seller.
        </li>
      </ul>
      <p>
        También podemos revelar datos cuando lo ordene una autoridad competente conforme a la ley. Dentro de la
        plataforma, cada Empresa solo ve sus propios datos y cada Transportista solo ve los envíos asignados a él.
      </p>
    </Seccion>

    <Seccion titulo="6. Transferencia internacional">
      <p>
        Los servidores de nuestros proveedores pueden estar fuera de la Argentina, por ejemplo en los Estados Unidos.
        Al aceptar esta política prestás tu consentimiento para esa transferencia, que se realiza con proveedores que
        asumen obligaciones de confidencialidad y seguridad, conforme al artículo 12 de la Ley 25.326.
      </p>
    </Seccion>

    <Seccion titulo="7. Cuánto tiempo los guardamos">
      <p>
        Mientras la cuenta esté activa. Al darse de baja, los datos se eliminan o anonimizan, salvo los que debamos
        conservar por una obligación legal o para defendernos ante un reclamo, durante el plazo de prescripción que
        corresponda. Los registros de intentos de inicio de sesión se conservan por períodos cortos.
      </p>
    </Seccion>

    <Seccion titulo="8. Seguridad">
      <p>
        Usamos conexiones cifradas (HTTPS), contraseñas con hash, credenciales de Mercado Libre cifradas, separación de
        datos entre empresas, límites de intentos de inicio de sesión y cierre de las sesiones abiertas al cambiar la
        contraseña. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te lo vamos a
        informar.
      </p>
    </Seccion>

    <Seccion titulo="9. Tus derechos">
      <p>
        Podés pedir el <strong>acceso</strong> a tus datos, su <strong>rectificación</strong>,{' '}
        <strong>actualización</strong> o <strong>supresión</strong>, y retirar tu consentimiento, escribiendo a{' '}
        <EmailDato campo="emailPrivacidad" /> desde el email de la cuenta o acreditando tu identidad. Respondemos los
        pedidos de acceso dentro de los 10 días corridos y los de rectificación, actualización o supresión dentro de los
        5 días hábiles, como establece la ley. El nombre de la cuenta y la contraseña también se pueden cambiar desde
        “Mi perfil”.
      </p>
      <p>
        Si sos comprador o Transportista, tus datos los cargó una Empresa: podés dirigirte a ella o escribirnos y
        canalizamos el pedido.
      </p>
      <p className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
        gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme
        lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN
        PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias
        y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes
        en materia de protección de datos personales.
      </p>
    </Seccion>

    <Seccion titulo="10. Menores">
      <p>PacKen no está dirigido a menores de 18 años y no recolectamos sus datos a sabiendas.</p>
    </Seccion>

    <Seccion titulo="11. Cookies">
      <p>
        Solo usamos cookies y almacenamiento estrictamente necesarios para que funcione la sesión. El detalle está en
        la <Link to="/cookies" className="text-yellow-700 underline">Política de cookies</Link>.
      </p>
    </Seccion>

    <Seccion titulo="12. Cambios">
      <p>
        Si cambiamos esta política de forma relevante lo vamos a avisar por email o en la plataforma antes de que
        entre en vigencia.
      </p>
    </Seccion>
  </PaginaLegal>
);

export default Privacidad;
