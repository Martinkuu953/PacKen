import { dbConfigurado, query } from '../lib/db.js';

const PAQUETES_DEV = [
  { idenvioml: 'ML-001', comprador: 'Ana García', direccion: 'Av. Corrientes 1234, CABA', estado: 'Atrasado' },
  { idenvioml: 'ML-002', comprador: 'Marcos López', direccion: 'Av. Santa Fe 567, CABA', estado: 'En camino' },
  { idenvioml: 'ML-003', comprador: 'Federico Ruiz', direccion: 'Av. Rivadavia 890, CABA', estado: 'Entregado' },
  { idenvioml: 'ML-004', comprador: 'Valentín Torres', direccion: 'Av. Cabildo 321, CABA', estado: 'Atrasado' },
];

const TABLAS_PAQUETE = ['paquete', 'paquetes'];

function mapPaquete(row) {
  return {
    idenvioml: row.idenvioml ?? row.id ?? '',
    comprador: row.comprador ?? row.cliente_final ?? row.cliente ?? '',
    direccion: row.direccion ?? row.ubicacion ?? '',
    estado: row.estado ?? '',
  };
}

function esErrorDeTabla(err) {
  return err?.code === '42P01';
}

async function selectPaquetes(tabla) {
  const { rows } = await query(`SELECT * FROM ${tabla}`);
  return rows;
}

async function obtenerDesdeDb() {
  let ultimoError = null;

  for (const tabla of TABLAS_PAQUETE) {
    try {
      const data = await selectPaquetes(tabla);
      return { paquetes: data.map(mapPaquete), origen: 'database', tabla };
    } catch (err) {
      if (esErrorDeTabla(err)) {
        ultimoError = err;
        continue;
      }
      throw err;
    }
  }

  if (ultimoError) {
    return {
      paquetes: PAQUETES_DEV,
      origen: 'fallback',
      aviso: 'Tabla paquete/paquetes no encontrada en la base. Mostrando datos de ejemplo.',
    };
  }

  return { paquetes: [], origen: 'database' };
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
