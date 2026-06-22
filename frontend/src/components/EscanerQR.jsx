import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { apiFetch } from '../services/api.js';

const READER_ID = 'lector-qr-packen';

const EscanerQR = ({ tipo, onCerrar, onPaqueteGuardado }) => {
  const lectorRef = useRef(null);
  const [estado, setEstado] = useState('iniciando');
  const [mensaje, setMensaje] = useState('');
  const [paqueteData, setPaqueteData] = useState(null);

  const detenerCamaraSeguro = async () => {
    const lector = lectorRef.current;
    if (!lector) return;

    try {
      const estadoActual = lector.getState();
      const estaActivo =
        estadoActual === Html5QrcodeScannerState.SCANNING ||
        estadoActual === Html5QrcodeScannerState.PAUSED;

      if (estaActivo) {
        await lector.stop();
      }
      lector.clear();
    } catch {
      // Ya detenido/destruido
    }
  };

  useEffect(() => {
    let cancelado = false;
    const lector = new Html5Qrcode(READER_ID);
    lectorRef.current = lector;

    lector
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (textoDecodificado) => {
          if (!cancelado) manejarLectura(textoDecodificado);
        },
        () => {}
      )
      .then(() => {
        if (cancelado) {
          detenerCamaraSeguro();
        } else {
          setEstado('escaneando');
        }
      })
      .catch((err) => {
        if (!cancelado) {
          setEstado('error');
          setMensaje('No se pudo acceder a la cámara: ' + err.message);
        }
      });

    return () => {
      cancelado = true;
      detenerCamaraSeguro();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manejarLectura = async (textoQR) => {
    setEstado('procesando');
    await detenerCamaraSeguro();

    let shipmentId = null;
    let sellerId = null;

    try {
      const obj = JSON.parse(textoQR);
      if (obj.id) shipmentId = String(obj.id);
      if (obj.sender_id) sellerId = String(obj.sender_id);
    } catch {
      setEstado('error');
      setMensaje('El QR escaneado no tiene el formato esperado de Mercado Libre.');
      return;
    }

    if (!shipmentId) {
      setEstado('error');
      setMensaje('No se encontró el Shipment ID en el QR.');
      return;
    }

    if (!sellerId) {
      setEstado('error');
      setMensaje('No se encontró el Seller ID (sender_id) en el QR.');
      return;
    }

    try {
      const resultado = await apiFetch('/api/paquetes/escanear', {
        method: 'POST',
        body: JSON.stringify({ shipmentId, sellerId, tipo }),
      });

      setPaqueteData(resultado.paquete);
      setEstado('ok');
      setMensaje(`Paquete ${shipmentId} guardado correctamente.`);
      onPaqueteGuardado?.(resultado.paquete);
    } catch (err) {
      setEstado('error');
      setMensaje(err.message || 'Error al procesar el paquete.');
    }
  };

  const reintentar = () => {
    setEstado('iniciando');
    setMensaje('');
    setPaqueteData(null);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            Escanear QR — {tipo === 'colecta' ? 'Colecta' : 'Reparto'}
          </h3>
          <button
            onClick={onCerrar}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div id={READER_ID} className="w-full rounded-xl overflow-hidden bg-gray-100" />

        {estado === 'procesando' && (
          <p className="mt-4 text-sm text-gray-600 text-center">Consultando Mercado Libre...</p>
        )}

        {estado === 'error' && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {mensaje}
            <button
              onClick={reintentar}
              className="block mt-2 text-red-700 underline font-medium"
            >
              Reintentar
            </button>
          </div>
        )}

        {estado === 'ok' && (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="font-semibold mb-2">{mensaje}</p>
            {paqueteData && (
              <div className="space-y-1 text-xs text-green-800 bg-green-100 rounded-lg p-3 mt-2">
                <p><span className="font-semibold">ID Envío:</span> {paqueteData.idenvioml}</p>
                <p><span className="font-semibold">Comprador:</span> {paqueteData.comprador || '—'}</p>
                <p><span className="font-semibold">Dirección:</span> {paqueteData.direccion || '—'}</p>
                <p><span className="font-semibold">Estado:</span> {paqueteData.estado}</p>
                {paqueteData.codigopostal && (
                  <p><span className="font-semibold">CP:</span> {paqueteData.codigopostal}</p>
                )}
              </div>
            )}
            <button
              onClick={onCerrar}
              className="block mt-3 text-green-800 underline font-medium"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EscanerQR;
