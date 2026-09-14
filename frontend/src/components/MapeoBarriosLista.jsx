import { useMemo, useState } from 'react';
import Buscador from './Buscador';
import { filtrarPorTexto } from '../utils/busqueda';

// Mapeo barrio→zona de UNA lista. El mismo barrio puede caer en zonas distintas
// según la lista, porque una "zona" solo significa algo dentro de un acuerdo
// tarifario.
//
// Lo que la lista no define cae en el default de la empresa ("Establecer
// zonas"). Los dos casos se distinguen a propósito: el heredado va punteado y
// el propio de la lista va lleno, así se ve de un vistazo qué se negoció
// distinto y qué viene por defecto.

const MapeoBarriosLista = ({ lista, areas, zonas, busy, onAsignar }) => {
  const [busqueda, setBusqueda] = useState('');

  // Overrides de esta lista, por barrio.
  const propias = useMemo(
    () => new Map((lista.areas ?? []).map((a) => [a.areaId, a.zonaId])),
    [lista.areas],
  );

  const encontradas = useMemo(() => filtrarPorTexto(areas, busqueda, ['nombre']), [areas, busqueda]);

  if (areas.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Todavía no hay barrios. Aparecen al escanear paquetes o sincronizando desde Flex.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Lo que no definas acá sigue la zona por defecto de la empresa (punteada).
      </p>

      {areas.length > 8 && (
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar barrio o municipio..."
          resultados={encontradas.length}
          total={areas.length}
        />
      )}

      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {encontradas.map((area) => {
          const propia = propias.get(area.id) ?? null;
          const efectiva = propia ?? area.zonaId;

          return (
            <div key={area.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{area.nombre}</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {zonas.map((z, i) => {
                  const activa = efectiva === z.id;
                  const heredada = activa && propia === null;

                  return (
                    <button
                      key={z.id}
                      type="button"
                      disabled={busy}
                      // Volver a tocar la zona activa propia borra el override y
                      // el barrio vuelve a seguir el default de la empresa.
                      onClick={() => onAsignar(area.id, propia === z.id ? null : z.id)}
                      title={
                        heredada
                          ? `${z.nombre} (por defecto de la empresa)`
                          : activa
                            ? `${z.nombre} — definida en esta lista, tocá para volver al default`
                            : z.nombre
                      }
                      className={`w-8 h-8 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
                        heredada
                          ? 'bg-transparent text-marca-grafito border-2 border-dashed border-marca-oro'
                          : activa
                            ? 'bg-marca-amarillo text-marca-grafito shadow-sm'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    >
                      {z.orden ?? i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MapeoBarriosLista;
