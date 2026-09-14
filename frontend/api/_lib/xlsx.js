import { deflateRawSync } from 'node:zlib';

// Generador mínimo de .xlsx (OOXML) sin dependencias.
//
// Un .xlsx es un ZIP con XML adentro. Armarlo a mano son ~150 líneas y evita
// sumarle al proyecto una librería de varios MB que además engorda el bundle de
// la Serverless Function.
//
// Alcance a propósito acotado a lo que necesita una liquidación: varias hojas,
// una fila de encabezado, celdas de texto y de número, y un formato de moneda.
// No hay fórmulas, ni imágenes, ni celdas combinadas.

// ──────────────────────────────────────────────────────────────────────────
// ZIP
// ──────────────────────────────────────────────────────────────────────────
const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[i] = c;
  }
  return tabla;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// ZIP clásico (sin ZIP64): alcanza de sobra para una planilla de texto.
function armarZip(archivos) {
  const locales = [];
  const central = [];
  let offset = 0;

  for (const { nombre, contenido } of archivos) {
    // El contenido puede ser XML (las partes del .xlsx) o un archivo ya armado
    // (un .xlsx entero, cuando lo que se empaqueta es el .zip de varias
    // liquidaciones sueltas).
    const crudo = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, 'utf8');
    const comprimido = deflateRawSync(crudo);
    const nombreBuf = Buffer.from(nombre, 'utf8');
    const crc = crc32(crudo);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión mínima
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // método: deflate
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(0x2821, 12); // fecha (2000-01-01): fija, para que el archivo sea reproducible
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(nombreBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra
    locales.push(local, nombreBuf, comprimido);

    const cabecera = Buffer.alloc(46);
    cabecera.writeUInt32LE(0x02014b50, 0);
    cabecera.writeUInt16LE(20, 4); // versión que lo creó
    cabecera.writeUInt16LE(20, 6); // versión mínima
    cabecera.writeUInt16LE(0, 8);
    cabecera.writeUInt16LE(8, 10);
    cabecera.writeUInt16LE(0, 12);
    cabecera.writeUInt16LE(0x2821, 14);
    cabecera.writeUInt32LE(crc, 16);
    cabecera.writeUInt32LE(comprimido.length, 20);
    cabecera.writeUInt32LE(crudo.length, 24);
    cabecera.writeUInt16LE(nombreBuf.length, 28);
    cabecera.writeUInt16LE(0, 30); // extra
    cabecera.writeUInt16LE(0, 32); // comentario
    cabecera.writeUInt16LE(0, 34); // disco
    cabecera.writeUInt16LE(0, 36); // atributos internos
    cabecera.writeUInt32LE(0, 38); // atributos externos
    cabecera.writeUInt32LE(offset, 42);
    central.push(cabecera, nombreBuf);

    offset += 30 + nombreBuf.length + comprimido.length;
  }

  const bufferCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(bufferCentral.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locales, bufferCentral, fin]);
}

// ──────────────────────────────────────────────────────────────────────────
// XML
// ──────────────────────────────────────────────────────────────────────────
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escaparXml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Los caracteres de control rompen el parser de Excel; una dirección
    // copiada de ML puede traerlos. Se conservan tab, LF y CR, que XML sí
    // admite. El rango de control es justamente el punto de la regla que
    // se desactiva acá.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

// 0 → A, 25 → Z, 26 → AA
function columna(indice) {
  let n = indice + 1;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

// Índices dentro de <cellXfs> de styles.xml.
const ESTILOS = { normal: 0, encabezado: 1, moneda: 2, negrita: 3, monedaNegrita: 4 };

function celda(ref, valor, estilo) {
  const s = estilo ? ` s="${estilo}"` : '';
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  }
  const texto = escaparXml(valor);
  if (!texto) return `<c r="${ref}"${s}/>`;
  // inlineStr en vez de sharedStrings: una parte menos que mantener, y el
  // tamaño de una liquidación no justifica la tabla compartida.
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${texto}</t></is></c>`;
}

function hojaXml({ columnas = [], filas = [] }) {
  const anchos = columnas.length
    ? `<cols>${columnas
        .map((ancho, i) => `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  const cuerpo = filas
    .map((fila, f) => {
      const celdas = fila
        .map((valor, c) => {
          const { v, s } = valor && typeof valor === 'object' && 'v' in valor
            ? valor
            : { v: valor, s: ESTILOS.normal };
          return celda(`${columna(c)}${f + 1}`, v, s);
        })
        .join('');
      return `<row r="${f + 1}">${celdas}</row>`;
    })
    .join('');

  return (
    `${DECL}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${anchos}<sheetData>${cuerpo}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  `${DECL}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFDE047"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// Excel rechaza el archivo si el nombre de hoja pasa los 31 caracteres o trae
// : \ / ? * [ ]
function nombreHoja(nombre, indice) {
  const limpio = String(nombre ?? '')
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 31);
  return limpio || `Hoja ${indice + 1}`;
}

/**
 * Arma un .xlsx y lo devuelve como Buffer.
 *
 * Cada hoja es `{ nombre, columnas: [ancho], filas: [[celda]] }`, donde una
 * celda es un valor suelto (texto o número) o `{ v, s }` con `s` sacado de
 * `ESTILOS_XLSX`.
 */
export function generarXlsx(hojas) {
  if (!hojas?.length) throw new Error('generarXlsx: se necesita al menos una hoja');

  const usados = new Set();
  const nombres = hojas.map((hoja, i) => {
    let nombre = nombreHoja(hoja.nombre, i);
    // Dos transportistas homónimos darían dos hojas con el mismo nombre y
    // Excel considera corrupto el archivo.
    let n = 2;
    while (usados.has(nombre.toLowerCase())) {
      const sufijo = ` (${n++})`;
      nombre = `${nombreHoja(hoja.nombre, i).slice(0, 31 - sufijo.length)}${sufijo}`;
    }
    usados.add(nombre.toLowerCase());
    return nombre;
  });

  const idEstilos = `rId${hojas.length + 1}`;

  const archivos = [
    {
      nombre: '[Content_Types].xml',
      contenido:
        `${DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        hojas
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    },
    {
      nombre: '_rels/.rels',
      contenido:
        `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      nombre: 'xl/workbook.xml',
      contenido:
        `${DECL}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        nombres
          .map((nombre, i) => `<sheet name="${escaparXml(nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('') +
        '</sheets></workbook>',
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido:
        `${DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        hojas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="${idEstilos}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    },
    { nombre: 'xl/styles.xml', contenido: STYLES_XML },
    ...hojas.map((hoja, i) => ({
      nombre: `xl/worksheets/sheet${i + 1}.xml`,
      contenido: hojaXml(hoja),
    })),
  ];

  return armarZip(archivos);
}

/**
 * Empaqueta varios archivos ya armados en un .zip y lo devuelve como Buffer.
 *
 * Cada archivo es `{ nombre, contenido }`, con el contenido como Buffer o texto.
 * Es el mismo ZIP que envuelve a un .xlsx, reusado para bajar una liquidación
 * por transportista en una sola descarga: el navegador bloquea las descargas
 * múltiples disparadas de a una.
 */
export function generarZip(archivos) {
  if (!archivos?.length) throw new Error('generarZip: se necesita al menos un archivo');
  return armarZip(archivos);
}

export { ESTILOS as ESTILOS_XLSX };
