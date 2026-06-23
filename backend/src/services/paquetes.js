import { dbConfigurado, query } from '../lib/db.js';

const PAQUETES_DEV = [
  { id: 1, idenvioml: 'ML-001', comprador: 'Ana García', direccion: 'Av. Corrientes 1234, CABA', estado: 'Atrasado', codigopostal: '1043' },
  { id: 2, idenvioml: 'ML-002', comprador: 'Marcos López', direccion: 'Av. Santa Fe 567, CABA', estado: 'En camino', codigopostal: '1060' },
  { id: 3, idenvioml: 'ML-003', comprador: 'Federico Ruiz', direccion: 'Av. Rivadavia 890, CABA', estado: 'Entregado', codigopostal: '1033' },
  { id: 4, idenvioml: 'ML-004', comprador: 'Valentín Torres', direccion: 'Av. Cabildo 321, CABA', estado: 'Ingresado', codigopostal: '1426' },
];

function mapPaquete(row) {
  return {
    id: row.id ?? row.idenvioml ?? '',
    idenvioml: row.idenvioml ?? row.id ?? '',
    comprador: row.comprador ?? row.cliente_final ?? row.cliente ?? '',
    direccion: row.direccion ?? row.ubicacion ?? '',
    estado: row.estado ?? '',
    codigopostal: row.codigopostal ?? '',
    fechaingreso: row.fechaingreso ?? null,
    fechaentrega: row.fechaentrega ?? null,
  };
}

function esErrorDeTabla(err) {
  return err?.code === '42P01';
}

async function obtenerDesdeDb() {
  try {
    const { rows } = await query('SELECT * FROM paquete ORDER BY fechaingreso DESC');
    return { paquetes: rows.map(mapPaquete), origen: 'database' };
  } catch (err) {
    if (esErrorDeTabla(err)) {
      return {
        paquetes: PAQUETES_DEV,
        origen: 'fallback',
        aviso: 'Tabla paquete no encontrada en la base. Mostrando datos de ejemplo.',
      };
    }
    throw err;
  }
}

export async function listarPaquetes() {
  if (!dbConfigurado()) {
    return {
      paquetes: PAQUETES_DEV,
      origen: 'dev',
      aviso: 'DATABASE_URL no configurado en backend/.env',
    };
  }

  try {
    return await obtenerDesdeDb();
  } catch (err) {
    console.error('[PacKen] Error al listar paquetes:', err.message);
    return {
      paquetes: PAQUETES_DEV,
      origen: 'fallback',
      aviso: err.message,
    };
  }
}

const ESTADOS_VALIDOS = ['Ingresado', 'En camino', 'Entregado', 'Cancelado', 'Reprogramado', 'Atrasado', 'Demorado'];

export async function cambiarEstado(id, nuevoEstado) {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw new Error(`Estado inválido: "${nuevoEstado}". Válidos: ${ESTADOS_VALIDOS.join(', ')}`);
  }

  const fechaEntrega = nuevoEstado === 'Entregado' ? new Date().toISOString() : null;

  const { rows } = await query(
    `UPDATE paquete
     SET estado = $1, fechaentrega = COALESCE($2, fechaentrega)
     WHERE id = $3
     RETURNING *`,
    [nuevoEstado, fechaEntrega, id]
  );

  if (!rows[0]) throw new Error(`Paquete con id=${id} no encontrado`);
  return mapPaquete(rows[0]);
}

export async function simularEntregas() {
  if (!dbConfigurado()) throw new Error('DATABASE_URL no configurado');

  const { rows } = await query(
    `UPDATE paquete
     SET estado = 'Entregado', fechaentrega = now()
     WHERE estado = 'En camino'
     RETURNING *`
  );

  return {
    ok: true,
    actualizados: rows.length,
    paquetes: rows.map(mapPaquete),
  };
}
