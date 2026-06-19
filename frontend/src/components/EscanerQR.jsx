import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { apiFetch } from '../services/api.js';

const READER_ID = 'lector-qr-packen';

const EscanerQR = ({ tipo, onCerrar, onPaqueteGuardado }) => {
  const lectorRef = useRef(null);
  const [estado, setEstado] = useState('iniciando'); // iniciando | escaneando | procesando | error | ok
  const [mensaje, setMensaje] = useState('');

  // Para parar el scanner de forma segura, sin importar en qué estado quedó
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
      // Si ya estaba detenido/destruido, no hacemos nada: no es un error real
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
        () => {
          /* frame sin QR detectado, se ignora */
        }
      )
      .then(() => {
        if (cancelado) {
          // El componente ya se desmontó mientras arrancaba la cámara: la apagamos ya mismo
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
    try {
      const obj = JSON.parse(textoQR);
      if (obj.id) shipmentId = String(obj.id);
    } catch {
      setEstado('error');
      setMensaje('El QR escaneado no tiene el formato esperado.');
      return;
    }

    if (!shipmentId) {
      setEstado('error');
      setMensaje('No se encontró el Shipment ID en el QR.');
      return;
    }

    try {
      const resultado = await apiFetch('/api/paquetes/escanear', {
        method: 'POST',
        body: JSON.stringify({ shipmentId, tipo }),
      });

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
          <p className="mt-4 text-sm text-gray-600 text-center">Procesando paquete…</p>
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
            {mensaje}
            <button
              onClick={onCerrar}
              className="block mt-2 text-green-800 underline font-medium"
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