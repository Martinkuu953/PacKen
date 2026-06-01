import { dbConfigurado, query } from '../lib/db.js';

const PAQUETES_DEV = [
  { cliente: 'Ana', seller: 'Baby Movil', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'Atrasado' },
  { cliente: 'Marcos', seller: 'Baby Movil', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'En camino' },
  { cliente: 'Federico', seller: 'Toca Juguetería', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'Entregado' },
  { cliente: 'Valentín', seller: 'Toys Kids', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'Atrasado' },
];

const TABLAS_PAQUETE = ['paquete', 'paquetes'];

function mapPaquete(row) {
  return {
    cliente: row.cliente_final ?? row.cliente ?? '',
    seller: row.seller ?? row.vendedor ?? '',
    transportista: row.transportista ?? '',
    ubicacion: row.ubicacion ?? '',
    zona: row.zona ?? '',
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
