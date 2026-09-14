import { TIPOS, crearHandler } from '../_lib/emision.js';

// /api/facturas — lo que la empresa le cobra a cada seller por los paquetes que
// se le entregaron en un período.
//
//   GET                                → { contrapartes }  (panel)
//   GET  ?contraparteIds=<uuid,uuid>   → + las últimas 5 de CADA uno
//   GET  ?ids=<uuid,uuid>              → el .xlsx de esas facturas
//   GET  ?ids=<uuid,uuid>&modo=separado → un .zip con un .xlsx por factura
//   GET  ?ids=<uuid>&formato=json      → su detalle, para la vista previa
//   POST { contraparteIds, desde, hasta } → las crea y devuelve la vista previa
//
// El importe de cada paquete sale de la lista de PRECIOS del seller
// (seller.idlista) cruzada con la zona del paquete. Un seller sin lista
// asignada no se puede facturar: no habría con qué calcular.
//
// Es el espejo exacto de /api/liquidaciones y comparte con él todo el motor en
// _lib/emision.js: lo único que cambia es a quién se le emite y con qué lista.
//
// Requiere migration-facturas.sql.

export default crearHandler(TIPOS.factura);
