import { useMemo, useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { colorEstado, prioridadEstado } from '../utils/estados';

// Columnas de la tabla. "importante: true" indica que esa columna
// se ordena por prioridad de estado en vez de alfabéticamente.
const COLUMNAS = [
  { campo: 'idenvioml', label: 'ID Envío ML' },
  { campo: 'comprador', label: 'Comprador' },
  { campo: 'direccion', label: 'Dirección' },
  { campo: 'estado', label: 'Estado', importante: true },
];

function compararPaquetes(a, b, campo, dir) {
  let resultado;
  if (campo === 'estado') {
    // "Lo más importante" primero: usamos la prioridad del estado.
    resultado = prioridadEstado(a.estado) - prioridadEstado(b.estado);
  } else {
    resultado = String(a[campo] ?? '').localeCompare(String(b[campo] ?? ''));
  }
  return dir === 'asc' ? resultado : -resultado;
}

const Paquetes = () => {
  const { paquetes, loading, error, aviso } = usePaquetes();

  // Por defecto ordenamos por estado (lo más importante primero).
  const [orden, setOrden] = useState({ campo: 'estado', dir: 'asc' });

  const paquetesOrdenados = useMemo(
    () => [...paquetes].sort((a, b) => compararPaquetes(a, b, orden.campo, orden.dir)),
    [paquetes, orden],
  );

  const cambiarOrden = (campo) => {
    setOrden((prev) =>
      prev.campo === campo
        ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' },
    );
  };

  const flecha = (campo) => {
    if (orden.campo !== campo) return '';
    return orden.dir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Paquetes</h2>
          <span className="text-sm text-gray-500">
            {loading ? 'Cargando…' : `${paquetes.length} envíos`}
          </span>
        </div>

        {aviso && !error && (
          <p className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            {aviso}
          </p>
        )}

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                {COLUMNAS.map((col) => (
                  <th
                    key={col.campo}
                    onClick={() => cambiarOrden(col.campo)}
                    className="py-2 px-2 cursor-pointer select-none hover:text-gray-800"
                  >
                    {col.label}
                    {col.importante ? ' (importancia)' : ''}
                    {flecha(col.campo)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={COLUMNAS.length} className="py-6 px-2 text-center text-gray-500">
                    Cargando paquetes…
                  </td>
                </tr>
              )}
              {!loading && paquetesOrdenados.length === 0 && !error && (
                <tr>
                  <td colSpan={COLUMNAS.length} className="py-6 px-2 text-center text-gray-500">
                    No hay paquetes registrados.
                  </td>
                </tr>
              )}
              {!loading &&
                paquetesOrdenados.map((paquete, index) => (
                  <tr
                    key={paquete.id ?? `${paquete.idenvioml}-${index}`}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="py-2 px-2 font-mono text-xs">{paquete.idenvioml}</td>
                    <td className="py-2 px-2 font-medium">{paquete.comprador}</td>
                    <td className="py-2 px-2 text-gray-600">{paquete.direccion}</td>
                    <td className={`py-2 px-2 font-bold ${colorEstado(paquete.estado)}`}>
                      {paquete.estado}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Paquetes;
