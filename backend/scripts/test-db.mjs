import 'dotenv/config';
import { probarConexionDb, query } from '../src/lib/db.js';

const ping = await probarConexionDb();
console.log('Conexión:', JSON.stringify(ping, null, 2));

if (ping.ok) {
  for (const tabla of ['paquete', 'paquetes']) {
    try {
      const { rows } = await query(`SELECT COUNT(*)::int AS total FROM ${tabla}`);
      console.log(`Tabla ${tabla}:`, rows[0].total, 'filas');
      break;
    } catch (e) {
      console.log(`Tabla ${tabla}:`, e.message);
    }
  }
}
