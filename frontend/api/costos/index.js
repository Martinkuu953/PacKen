import { manejarListas } from '../_lib/listas.js';

// /api/costos — listas de COSTOS (lo que se le paga a cada transportista), por
// zona. Las zonas y áreas se leen de acá pero se administran desde /api/precios
// (son compartidas). La lógica vive en _lib/listas.js para no gastar una
// Serverless Function extra (el plan Hobby de Vercel permite 12).
//
//   GET    → { listas, zonas (solo lectura), entidades (transportistas) }
//   POST   → { op, ... }  crearLista | renombrarLista | setTarifa |
//                         setTarifasBulk | asignarEntidad
//   DELETE → ?listaId=<public_id>
export default function handler(req, res) {
  return manejarListas(req, res, 'costo');
}
