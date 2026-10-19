import { Link } from 'react-router-dom';
import PaginaLegal, { Dato, EmailDato, Seccion } from '../../components/PaginaLegal';

const Terminos = () => (
  <PaginaLegal titulo="Términos y condiciones de uso">
    <p className="mt-6 text-[15px] leading-relaxed text-gray-700">
      Estos términos regulan el uso de PacKen, la plataforma web de gestión logística para empresas que reparten
      envíos de Mercado Libre. Al crear una cuenta o usar la plataforma aceptás estos términos y la{' '}
      <Link to="/privacidad" className="text-yellow-700 underline">Política de privacidad</Link>. Si no estás de
      acuerdo, no uses PacKen.
    </p>

    <Seccion titulo="1. Quién presta el servicio">
      <p>
        PacKen es operado por <Dato campo="razonSocial" />, CUIT <Dato campo="cuit" />, con domicilio en{' '}
        <Dato campo="domicilio" /> (en adelante, “PacKen”). Contacto: <EmailDato campo="emailContacto" />.
      </p>
    </Seccion>

    <Seccion titulo="2. Qué es PacKen">
      <p>
        PacKen permite a una empresa de logística (la “Empresa”): conectar las cuentas de Mercado Libre de los
        vendedores para los que reparte (“Sellers”); registrar los envíos escaneando el código QR de la etiqueta;
        asignarlos a sus repartidores (“Transportistas”); ver el estado de cada envío, que se actualiza con la
        información que informa Mercado Libre; agrupar los envíos por zona; y generar, a partir de listas de precios y
        costos que carga la propia Empresa, resúmenes de cobro a Sellers y de pago a Transportistas, además de
        estadísticas.
      </p>
      <p>
        PacKen no es un servicio de Mercado Libre ni está afiliado, patrocinado o aprobado por Mercado Libre. “Mercado
        Libre” es una marca de su titular y se menciona solo para describir la integración.
      </p>
    </Seccion>

    <Seccion titulo="3. Quién puede usar PacKen">
      <p>
        El registro está destinado a empresas y profesionales que realizan actividad logística. Quien crea la cuenta
        declara ser mayor de 18 años y tener facultades suficientes para obligar a la Empresa que registra.
      </p>
      <p>
        Las cuentas de Transportista no se crean por registro público: las crea la Empresa desde su panel y la
        Empresa es responsable de esas cuentas.
      </p>
    </Seccion>

    <Seccion titulo="4. Veracidad de los datos">
      <p>
        Todos los datos que se cargan en PacKen (de la Empresa, de los Transportistas, de los Sellers y de los envíos)
        tienen carácter de declaración jurada. Quien los carga declara que son <strong>verdaderos, exactos,
        completos y actualizados</strong>, y que tiene derecho a usarlos.
      </p>
      <p>Está prohibido, entre otras cosas:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>registrarse con datos falsos, inventados o de otra persona o empresa;</li>
        <li>crear cuentas de Transportista para personas que no lo autorizaron o con un DNI o email ajeno;</li>
        <li>conectar cuentas de Mercado Libre de Sellers sin su autorización;</li>
        <li>cargar o alterar envíos, estados o importes para simular operaciones que no ocurrieron.</li>
      </ul>
      <p>
        PacKen puede pedir que se acrediten los datos y suspender o dar de baja las cuentas cuando existan indicios
        razonables de que son falsos, sin perjuicio de las acciones legales que correspondan. Quien cargue datos
        falsos responde por los daños que cause a PacKen y a terceros.
      </p>
    </Seccion>

    <Seccion titulo="5. Cuenta y seguridad">
      <p>
        Las credenciales son personales. Cada usuario es responsable de mantener su contraseña en secreto y de lo que
        se haga con su cuenta. Si sospechás un uso no autorizado, cambiá la contraseña desde “Mi perfil” y avisanos a{' '}
        <EmailDato campo="emailContacto" />.
      </p>
      <p>
        La Empresa es responsable de entregar a cada Transportista su contraseña inicial por un medio seguro, de
        restablecerla cuando corresponda y de eliminar las cuentas de quienes dejen de trabajar con ella.
      </p>
    </Seccion>

    <Seccion titulo="6. Integración con Mercado Libre">
      <p>
        Para conectar un Seller, el titular de la cuenta de Mercado Libre inicia sesión en Mercado Libre y autoriza a
        PacKen a consultar sus envíos. La Empresa declara contar con el acuerdo del Seller para hacerlo y para tratar
        los datos de sus envíos con el fin de repartirlos. El Seller puede revocar ese acceso en cualquier momento
        desde su cuenta de Mercado Libre.
      </p>
      <p>
        Los estados de los envíos se obtienen de Mercado Libre. PacKen no garantiza la disponibilidad, exactitud ni
        continuidad de la información o de la interfaz de Mercado Libre, ni responde por cambios que Mercado Libre
        introduzca en ella.
      </p>
    </Seccion>

    <Seccion titulo="7. Datos personales que carga la Empresa">
      <p>
        Respecto de los datos de los compradores (destinatarios de los envíos) y de los Transportistas, la Empresa es
        la responsable de la base de datos en los términos de la Ley 25.326 y PacKen actúa como encargado del
        tratamiento: los trata solo para prestar el servicio, según las instrucciones de la Empresa, y no los usa para
        fines propios ni los vende.
      </p>
      <p>
        La Empresa declara contar con una base legal para tratar esos datos, haber informado a los titulares en los
        términos del artículo 6 de la Ley 25.326 y usarlos exclusivamente para gestionar las entregas. Está prohibido
        usar los datos de los compradores para publicidad, contacto comercial o cualquier otro fin. El detalle está en
        la <Link to="/privacidad" className="text-yellow-700 underline">Política de privacidad</Link>.
      </p>
    </Seccion>

    <Seccion titulo="8. Resúmenes de cobro, liquidaciones y estadísticas">
      <p>
        Las “facturas” y “liquidaciones” que genera PacKen son <strong>resúmenes internos de gestión</strong>
        calculados con las listas de precios y costos y las zonas que define la Empresa. <strong>No son comprobantes
        fiscales</strong> ni reemplazan las facturas que exige ARCA (ex AFIP). La Empresa debe controlar los importes
        antes de usarlos y es la única responsable de su facturación y de sus obligaciones impositivas.
      </p>
    </Seccion>

    <Seccion titulo="9. Uso permitido">
      <p>No está permitido:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>usar PacKen para actividades ilícitas o que infrinjan derechos de terceros;</li>
        <li>intentar acceder a cuentas, datos o envíos de otras empresas;</li>
        <li>vulnerar, sobrecargar o probar la seguridad de la plataforma sin autorización escrita;</li>
        <li>automatizar el acceso (scraping, bots) fuera de las funciones que ofrece PacKen;</li>
        <li>copiar, revender o sublicenciar la plataforma.</li>
      </ul>
    </Seccion>

    <Seccion titulo="10. Precio">
      <p>
        Hoy el uso de PacKen es gratuito. Si en el futuro se incorporan planes pagos, se informarán con al menos 30
        días de anticipación y no se cobrará nada sin que la Empresa lo acepte expresamente.
      </p>
    </Seccion>

    <Seccion titulo="11. Disponibilidad del servicio">
      <p>
        PacKen se presta “tal como está”. Trabajamos para que funcione de forma continua y segura, pero puede haber
        interrupciones por mantenimiento, fallas de proveedores (hosting, base de datos, Mercado Libre) o causas
        ajenas. Recomendamos exportar periódicamente la información relevante (por ejemplo, los Excel de
        estadísticas, facturas y liquidaciones).
      </p>
    </Seccion>

    <Seccion titulo="12. Responsabilidad">
      <p>
        PacKen es una herramienta de gestión: la Empresa sigue siendo la única responsable del transporte y la
        entrega de los envíos, de su relación con Sellers, compradores y Transportistas, y de las decisiones que tome
        con la información de la plataforma.
      </p>
      <p>
        En la medida que lo permita la ley, PacKen no responde por lucro cesante, pérdida de datos causada por el
        usuario, ni por daños derivados de información incorrecta cargada por los usuarios o recibida de Mercado
        Libre. Nada en estos términos limita los derechos que la Ley 24.240 de Defensa del Consumidor reconoce cuando
        resulte aplicable.
      </p>
    </Seccion>

    <Seccion titulo="13. Propiedad intelectual">
      <p>
        El software, la marca PacKen, el logo y los contenidos de la plataforma pertenecen a su titular. Los datos que
        carga la Empresa son de la Empresa.
      </p>
    </Seccion>

    <Seccion titulo="14. Baja de la cuenta">
      <p>
        La Empresa puede pedir la baja de su cuenta en cualquier momento escribiendo a{' '}
        <EmailDato campo="emailPrivacidad" /> desde el email registrado. Antes de la baja puede descargar sus datos.
        Al darse de baja se eliminan o anonimizan sus datos, salvo los que debamos conservar por obligación legal.
      </p>
      <p>
        PacKen puede suspender o dar de baja una cuenta que incumpla estos términos, avisando por email salvo que la
        gravedad del caso lo impida.
      </p>
    </Seccion>

    <Seccion titulo="15. Cambios en los términos">
      <p>
        Podemos modificar estos términos. Los cambios relevantes se avisarán por email o en la plataforma con al
        menos 15 días de anticipación. Seguir usando PacKen después de esa fecha implica aceptar la nueva versión.
      </p>
    </Seccion>

    <Seccion titulo="16. Ley aplicable y jurisdicción">
      <p>
        Estos términos se rigen por las leyes de la República Argentina. Cualquier conflicto se someterá a{' '}
        <Dato campo="jurisdiccion" />, salvo que la ley aplicable a una relación de consumo disponga otra
        jurisdicción.
      </p>
    </Seccion>
  </PaginaLegal>
);

export default Terminos;
