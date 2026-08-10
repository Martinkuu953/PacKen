import { useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { ESTADOS, colorEstado } from '../utils/estados';
import { marcarEntregado } from '../services/paquetes';
import EscanerQR from '../components/EscanerQR';

// La pantalla del transportista es deliberadamente mínima: tres acciones
// grandes, pensadas para usarse con una mano y en la calle.
const ACCIONES = [
  { clave: 'colecta', titulo: 'Colecta', detalle: 'Escanear paquetes que retirás' },
  { clave: 'reparto', titulo: 'Reparto', detalle: 'Escanear paquetes que salís a repartir' },
  { clave: 'entrega', titulo: 'Entrega', detalle: 'Marcar paquetes como entregados' },
];

const BOTON = 'w-full py-8 px-6 text-left bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 active:bg-yellow-100 transition-colors duration-150 shadow-sm';

const Menu = ({ onElegir, pendientesEntrega }) => (
  <div className="max-w-xl mx-auto">
    <h2 className="text-2xl font-bold text-gray-800 mb-6">Paquetes</h2>
    <div className="space-y-4">
      {ACCIONES.map((accion) => (
        <button key={accion.clave} onClick={() => onElegir(accion.clave)} className={BOTON}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-800">{accion.titulo}</p>
              <p className="text-sm text-gray-500 mt-1">{accion.detalle}</p>
            </div>
            {accion.clave === 'entrega' && pendientesEntrega > 0 && (
              <span className="text-3xl font-bold text-yellow-500">{pendientesEntrega}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  </div>
);

const ListaEntrega = ({ paquetes, loading, error, onVolver, onRecargar }) => {
  const [entregando, setEntregando] = useState(null);

  const handleEntregar = async (id) => {
    setEntregando(id);
    try {
      await marcarEntregado(id);
      onRecargar();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setEntregando(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onVolver}
          className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
          aria-label="Volver"
        >
          ←
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Entrega</h2>
      </div>

      {error && (
        <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {loading && <p className="text-gray-500">Cargando paquetes...</p>}

      {!loading && paquetes.length === 0 && !error && (
        <p className="text-gray-500 bg-white border border-gray-200 rounded-2xl p-6 text-center">
          No tenés paquetes en camino.
        </p>
      )}

      <div className="space-y-3">
        {paquetes.map((paquete) => (
          <div key={paquete.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4">
            <p className="font-semibold text-gray-800 text-lg leading-tight">{paquete.direccion}</p>
            <p className="text-sm text-gray-500 mt-1">
              {paquete.comprador || 'Sin comprador'} · CP {paquete.codigopostal || '—'}
            </p>
            <p className={`text-sm font-bold mt-1 ${colorEstado(paquete.estado)}`}>{paquete.estado}</p>
            <button
              onClick={() => handleEntregar(paquete.id)}
              disabled={entregando === paquete.id}
              className="mt-3 w-full py-4 bg-green-500 text-white text-lg font-bold rounded-xl hover:bg-green-600 active:bg-green-700 disabled:opacity-50 transition-colors duration-150"
            >
              {entregando === paquete.id ? 'Entregando...' : 'Entregar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const PaquetesTransportista = () => {
  const { paquetes, loading, error, recargar } = usePaquetes({ estado: ESTADOS.EN_CAMINO });
  const [accion, setAccion] = useState(null);

  if (accion === 'colecta' || accion === 'reparto') {
    return (
      <EscanerQR
        tipo={accion}
        onCerrar={() => setAccion(null)}
        onPaqueteGuardado={() => recargar()}
      />
    );
  }

  if (accion === 'entrega') {
    return (
      <ListaEntrega
        paquetes={paquetes}
        loading={loading}
        error={error}
        onVolver={() => setAccion(null)}
        onRecargar={recargar}
      />
    );
  }

  return <Menu onElegir={setAccion} pendientesEntrega={paquetes.length} />;
};

export default PaquetesTransportista;
