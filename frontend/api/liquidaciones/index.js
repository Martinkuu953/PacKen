import { TIPOS, crearHandler } from '../_lib/emision.js';

// /api/liquidaciones — lo que la empresa le paga a cada transportista por los
// paquetes que entregó en un período.
//
//   GET                                → { contrapartes }  (panel)
//   GET  ?contraparteIds=<uuid,uuid>   → + las últimas 5 de CADA uno
//   GET  ?ids=<uuid,uuid>              → el .xlsx de esas liquidaciones
//   GET  ?ids=<uuid,uuid>&modo=separado → un .zip con un .xlsx por liquidación
//   GET  ?ids=<uuid>&formato=json      → su detalle, para la vista previa
//   POST { contraparteIds, desde, hasta } → las crea y devuelve la vista previa
//
// El importe de cada paquete sale de la lista de COSTOS del transportista
// (usuario.idlista_costo) cruzada con la zona del paquete. Un transportista sin
// lista asignada no se puede liquidar: no habría con qué calcular.
//
// Toda la lógica vive en _lib/emision.js, compartida con /api/facturas: son el
// mismo documento con la contraparte cambiada.
//
// Requiere migration-liquidaciones.sql.

export default crearHandler(TIPOS.liquidacion);
