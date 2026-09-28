// Utilidades compartidas por los handlers de /api/paquetes/*.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// N-02: el cliente identifica un paquete por su public_id (UUID), nunca por el
// id SERIAL. Validar el formato antes de consultar evita que un valor
// cualquiera llegue a Postgres y termine en un error de tipo.
export function esUuid(valor) {
  return typeof valor === 'string' && UUID_RE.test(valor);
}

// Lo único de un paquete que sale del servidor como respuesta de una acción
// (escanear, cambiar estado). Sin ids internos: ni id, ni idempresa, ni
// idseller, ni idtransportista.
export function paquetePublico(p) {
  if (!p) return null;
  return {
    id: p.public_id,
    idenvioml: p.idenvioml,
    comprador: p.comprador,
    direccion: p.direccion,
    codigopostal: p.codigopostal,
    estado: p.estado,
    fechaingreso: p.fechaingreso,
    fechaentrega: p.fechaentrega,
  };
}
