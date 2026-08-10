import { useMemo, useState } from 'react';
import { usePaquetes } from '../hooks/usePaquetes';
import { ESTADOS, canonizarEstado, colorEstado } from '../utils/estados';
import { marcarEntregado } from '../services/paquetes';
import EscanerQR from '../components/EscanerQR';

// La pantalla del transportista es deliberadamente mínima: dos acciones
// grandes, pensadas para usarse con una mano y en la calle.
const VISTAS = {
  colecta: {
    titulo: 'Colecta',
    detalle: 'Paquetes que retirás',
    estado: ESTADOS.INGRESADO,
  },
  reparto: {
    titulo: 'Reparto',
    detalle: 'Paquetes que salís a repartir',
    estado: ESTADOS.EN_CAMINO,
  },
};

const CLAVES = Object.keys(VISTAS);

const Menu = ({ onElegir, conteos }) => (
  <div className="max-w-xl mx-auto">
    <h2 className="text-2xl font-bold text-gray-800 mb-6">Paquetes</h2>
    <div className="space-y-4">
      {CLAVES.map((clave) => (
        <button
          key={clave}
          onClick={() => onElegir(clave)}
          className="w-full py-8 px-6 text-left bg-white border-2 border-gray-200 rounded-2xl hover:border-yellow-400 hover:bg-yellow-50 active:bg-yellow-100 transition-colors duration-150 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-800">{VISTAS[clave].titulo}</p>
              <p className="text-sm text-gray-500 mt-1">{VISTAS[clave].detalle}</p>
            </div>
            <span className="text-3xl font-bold text-yellow-500">{conteos[clave]}</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);

const Listado = ({ vista, paquetes, loading, error, onVolver, onEscanear, onRecargar }) => {
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
    <div className="max-w-xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
            aria-label="Volver"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-gray-800">{vista.titulo}</h2>
        </div>
        <span className="text-sm text-gray-500">
          {loading ? 'Cargando...' : `${paquetes.length} envíos`}
        </span>
      </div>

      {error && (
        <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {!loading && paquetes.length === 0 && !error && (
        <p className="text-gray-500 bg-white border border-gray-200 rounded-2xl p-6 text-center">
          No tenés paquetes en {vista.titulo.toLowerCase()}.
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
            {canonizarEstado(paquete.estado) === ESTADOS.EN_CAMINO && (
              <button
                onClick={() => handleEntregar(paquete.id)}
                disabled={entregando === paquete.id}
                className="mt-3 w-full py-4 bg-green-500 text-white text-lg font-bold rounded-xl hover:bg-green-600 active:bg-green-700 disabled:opacity-50 transition-colors duration-150"
              >
                {entregando === paquete.id ? 'Entregando...' : 'Entregar'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pegado al borde inferior: es la acción principal de la pantalla y
          tiene que quedar al alcance del pulgar por más larga que sea la lista. */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#F3F4F6] via-[#F3F4F6] to-transparent">
        <div className="max-w-xl mx-auto">
          <button
            onClick={onEscanear}
            className="w-full py-5 bg-gray-800 text-white text-xl font-bold rounded-2xl shadow-lg hover:bg-gray-900 active:bg-black transition-colors duration-150"
          >
            Escanear con la cámara
          </button>
        </div>
      </div>
    </div>
  );
};

const PaquetesTransportista = () => {
  const { paquetes, loading, error, recargar } = usePaquetes();
  const [vistaActiva, setVistaActiva] = useState(null);
  const [escaneando, setEscaneando] = useState(false);

  const porVista = useMemo(() => {
    const agrupado = Object.fromEntries(CLAVES.map((clave) => [clave, []]));
    for (const paquete of paquetes) {
      const estado = canonizarEstado(paquete.estado);
      const clave = CLAVES.find((c) => VISTAS[c].estado === estado);
      if (clave) agrupado[clave].push(paquete);
    }
    return agrupado;
  }, [paquetes]);

  const conteos = Object.fromEntries(CLAVES.map((clave) => [clave, porVista[clave].length]));

  if (vistaActiva) {
    return (
      <>
        <Listado
          vista={VISTAS[vistaActiva]}
          paquetes={porVista[vistaActiva]}
          loading={loading}
          error={error}
          onVolver={() => setVistaActiva(null)}
          onEscanear={() => setEscaneando(true)}
          onRecargar={recargar}
        />
        {/* El escáner es un overlay: el listado queda detrás y vuelve a
            aparecer al cerrarlo, sin remontarse. */}
        {escaneando && (
          <EscanerQR
            tipo={vistaActiva}
            onCerrar={() => setEscaneando(false)}
            onPaqueteGuardado={() => recargar()}
          />
        )}
      </>
    );
  }

  return <Menu onElegir={setVistaActiva} conteos={conteos} />;
};

export default PaquetesTransportista;
