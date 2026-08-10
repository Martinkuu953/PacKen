import { manejarListas } from '../_lib/listas.js';

// /api/precios — listas de PRECIOS (lo que se le cobra a cada seller), por zona.
//
// Además de las listas, este endpoint administra las ZONAS y las ÁREAS de Flex
// (barrios/municipios), que son compartidas entre precios y costos. La lógica
// vive en _lib/listas.js para no gastar una Serverless Function extra (el plan
// Hobby de Vercel permite 12).
//
//   GET    → { listas, zonas, entidades (sellers), areas }
//   POST   → { op, ... }  crearLista | renombrarLista | setTarifa |
//                         setTarifasBulk | asignarEntidad |
//                         crearZona | renombrarZona | borrarZona |
//                         asignarArea | sincronizarAreasFlex
//   DELETE → ?listaId=<public_id>
export default function handler(req, res) {
  return manejarListas(req, res, 'precio');
}
