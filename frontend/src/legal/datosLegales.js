// Datos del titular de PacKen que aparecen en Términos, Privacidad, Cookies y
// el pie de la landing. ÚNICO lugar a editar.
//
// Los valores entre corchetes son marcadores: mientras empiecen con "[" se
// muestran resaltados en las páginas legales, para que no salga a producción
// un dato inventado sin que se note. Completalos con los datos reales antes
// del lanzamiento y hacé revisar los textos por un abogado.
import { VERSION_TERMINOS } from '../../shared/legal.js';

export const DATOS_LEGALES = {
  // Persona humana o jurídica que explota PacKen.
  razonSocial: '[Razón social del titular]',
  cuit: '[CUIT]',
  domicilio: '[Domicilio legal completo]',
  // Casilla que se lee: consultas generales y soporte.
  emailContacto: '[email de contacto]',
  // Casilla para ejercer derechos de acceso, rectificación y supresión.
  emailPrivacidad: '[email de privacidad]',
  // Tribunales para cualquier conflicto (lo define el titular con su abogado),
  // p. ej.: 'los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires'.
  jurisdiccion: '[tribunales competentes]',
  // Se cambia en shared/legal.js: el registro guarda qué versión aceptó cada
  // empresa (ver migration-legal.sql).
  version: VERSION_TERMINOS,
  vigenciaDesde: '19 de octubre de 2026',
};

export const esMarcador = (valor) => typeof valor === 'string' && valor.startsWith('[');
