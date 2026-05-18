import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../supabaseClient';

const Paquetes = () => {
  // --- SISTEMA ANTI-CRASH (Caja Negra) ---
  const [crashLog, setCrashLog] = useState(null);

  useEffect(() => {
    // Atrapamos errores normales de React/JS
    const handleGlobalError = (event) => {
      setCrashLog(event.message || String(event.error));
    };
    // Atrapamos errores asíncronos (promesas rotas de la cámara)
    const handleUnhandledRejection = (event) => {
      setCrashLog(String(event.reason));
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // --- ESTADOS NORMALES ---
  const [modo, setModo] = useState(null); 
  const [resultado, setResultado] = useState(null);
  const [zonaAsignada, setZonaAsignada] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [paso, setPaso] = useState('escaneando'); 
  const [codigoManual, setCodigoManual] = useState('');

  const scannerRef = useRef(null);
  const pasoRef = useRef(paso); 
  const readerId = "lector-camara-fullscreen";

  useEffect(() => {
    pasoRef.current = paso;
  }, [paso]);

  // 1. Validación manual (Defensiva)
  const validarCodigoManual = (codigo) => {
    try {
      const texto = String(codigo); // Forzamos a string siempre
      if (!texto || texto.length < 3 || texto.length > 250) return false;
      for (let i = 0; i < texto.length; i++) {
        const ascii = texto.charCodeAt(i);
        if (ascii < 32 || ascii > 126) return false; 
      }
      return true; 
    } catch (e) {
      return false; // Si falla la validación, lo rechazamos, pero no crasheamos
    }
  };

  // 2. Función al detectar QR (Blindada contra errores)
  const procesarLectura = (textoDecodificado) => {
    try {
      if (pasoRef.current !== 'escaneando') return;

      // DEFENSIVO: Si la librería de ML devuelve un objeto raro, lo hacemos texto sí o sí
      const textoSeguro = typeof textoDecodificado === 'object' ? JSON.stringify(textoDecodificado) : String(textoDecodificado);

      if (validarCodigoManual(textoSeguro)) {
        setResultado(textoSeguro);
        setPaso('confirmando');
        setMensajeError('');
        setCodigoManual(''); 
      } else {
        setMensajeError('Formato inválido.');
      }
    } catch (error) {
      // Si algo de acá explota, lo mandamos a la pantalla roja
      setCrashLog("Error procesando lectura: " + String(error));
    }
  };

  const handleIngresoManual = () => {
    if (codigoManual.trim() === '') {
      setMensajeError('Ingresá un código.');
      return;
    }
    procesarLectura(codigoManual.trim());
  };

  // 3. Guardar en Supabase
  const confirmarYGuardar = async () => {
    setProcesando(true);
    setMensajeError('');
    setZonaAsignada(null);

    try {
      const paqueteData = {
        IdEnvioML: resultado,
        IdSeller: 1, 
        IdZona: 1,  
        Estado: modo === 'colecta' ? 'Ingresado' : 'En camino' 
      };

      if (modo === 'reparto') paqueteData.IdTransportista = 1; 

      const { error } = await supabase.from('Paquete').insert([paqueteData]);
      if (error) throw error;

      setZonaAsignada("ZONA 1"); 
      setPaso('guardado');
    } catch (err) {
      setMensajeError("Error al guardar en la base de datos.");
    } finally {
      setProcesando(false);
    }
  };

  // 4. Encendido de Cámara
  useEffect(() => {
    if (modo) {
      const html5QrCode = new Html5Qrcode(readerId);
      scannerRef.current = html5QrCode;

      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (texto) => procesarLectura(texto), 
        () => { }
      ).catch((err) => {
        console.error(err);
      });

      return () => {
        if (scannerRef.current) {
          scannerRef.current.stop()
            .then(() => { scannerRef.current.clear(); })
            .catch(() => { });
        }
      };
    }
  }, [modo]); 

  const resetearEscaneo = () => {
    setResultado(null);
    setZonaAsignada(null);
    setMensajeError('');
    setCodigoManual('');
    setPaso('escaneando');
  };

  // ==========================================
  // RENDERIZADO CONDICIONAL DE EMERGENCIA
  // ==========================================
  if (crashLog) {
    return (
      <div className="min-h-screen bg-red-900 text-white p-6 flex flex-col items-center justify-center">
        <h1 className="text-4xl font-black mb-4 text-center">💥 CRASH DETECTADO</h1>
        <p className="mb-4 text-center font-medium">Sacale captura a este error y pasámelo:</p>
        <div className="bg-black p-4 rounded-xl w-full max-w-md font-mono text-sm break-words text-red-400 border border-red-500 shadow-xl">
          {crashLog}
        </div>
        <button onClick={() => window.location.reload()} className="mt-8 bg-white text-red-900 font-bold py-4 px-8 rounded-full active:scale-95 shadow-lg">
          Recargar App
        </button>
      </div>
    );
  }

  // --- INTERFAZ 1: SELECCIÓN DE MODO ---
  if (!modo) {
    return (
      <div className="max-w-md mx-auto min-h-[85vh] flex flex-col items-center justify-center p-6 bg-gray-50">
        <h2 className="text-2xl font-semibold text-gray-900 mb-10 text-center">Iniciá el proceso</h2>
        <div className="w-full space-y-5">
          <button onClick={() => setModo('colecta')} className="w-full bg-white border border-gray-100 text-gray-900 text-2xl font-medium py-8 rounded-[24px] shadow-sm hover:border-yellow-400 active:scale-95 transition-all">Colecta</button>
          <button onClick={() => setModo('reparto')} className="w-full bg-white border border-gray-100 text-gray-900 text-2xl font-medium py-8 rounded-[24px] shadow-sm hover:border-yellow-400 active:scale-95 transition-all">Reparto</button>
        </div>
      </div>
    );
  }

  // --- INTERFAZ 2: ESCÁNER ---
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-lg mx-auto">
      <style>{`
          #${readerId} video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
              border-radius: 1.5rem !important;
          }
      `}</style>

      {/* Cabecera */}
      <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => { setModo(null); resetearEscaneo(); }} className="text-gray-900 font-semibold p-2 text-2xl active:scale-90">←</button>
          <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">{modo === 'colecta' ? 'Modo Colecta' : 'Modo Reparto'}</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col pt-24 pb-8 px-4">
        {/* LA CÁMARA */}
        <div className="w-full flex justify-center mb-6 relative">
          <div id={readerId} className={`w-full bg-black rounded-3xl shadow-lg border-4 border-yellow-400 aspect-square overflow-hidden transition-opacity ${paso !== 'escaneando' ? 'opacity-30' : 'opacity-100'}`}>
             {paso === 'escaneando' && (
              <div className="flex flex-col items-center justify-center p-12 text-gray-400 absolute inset-0 z-[-1]">
                <div className="w-8 h-8 border-4 border-gray-600 border-t-gray-300 rounded-full animate-spin mb-4"></div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL INFERIOR */}
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 min-h-[250px] flex-1 flex flex-col">
          
          {paso === 'escaneando' && (
            <div className="flex flex-col h-full justify-start items-center gap-4">
              <p className="text-sm font-medium text-gray-600 text-center">Enfocá el código QR, o ingresalo manual:</p>
              <div className="w-full flex gap-2">
                <input type="text" placeholder="Pegá o escribí el código" value={codigoManual} onChange={(e) => setCodigoManual(e.target.value)} className="flex-1 bg-gray-100 border border-gray-200 text-gray-900 text-base rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all font-mono" />
                <button onClick={handleIngresoManual} className="bg-gray-900 text-white font-semibold px-5 rounded-2xl active:scale-95 transition-transform text-sm">Ingresar</button>
              </div>
            </div>
          )}

          {paso === 'confirmando' && (
            <div className="flex flex-col h-full justify-center items-center gap-6 animate-fade-in-up">
              <div className="space-y-2 text-center w-full">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">¿Es el paquete correcto?</h3>
                <div className="bg-gray-100 text-gray-900 p-4 rounded-xl">
                  <p className="font-mono text-base font-semibold break-all text-left max-h-32 overflow-y-auto">{resultado}</p>
                </div>
              </div>
              <div className="w-full flex gap-3">
                <button onClick={confirmarYGuardar} disabled={procesando} className="flex-1 bg-yellow-400 text-gray-950 text-base font-semibold py-4 rounded-2xl active:scale-95 disabled:opacity-50">Confirmar</button>
                <button onClick={resetearEscaneo} className="bg-gray-200 text-gray-800 text-base font-semibold px-6 rounded-2xl active:scale-95">X</button>
              </div>
            </div>
          )}

          {paso === 'guardado' && zonaAsignada && (
            <div className="flex flex-col h-full justify-center items-center gap-6 animate-scale-in">
              <div className="bg-green-500 text-white p-6 rounded-[20px] w-full text-center">
                <p className="text-xs font-semibold uppercase mb-1 opacity-80">Ingresado a</p>
                <p className="text-4xl font-semibold">{zonaAsignada}</p>
              </div>
              <button onClick={resetearEscaneo} className="w-full bg-gray-900 text-white text-base font-semibold py-4 rounded-xl active:scale-95">Escanear Siguiente</button>
            </div>
          )}

          {mensajeError && (
            <div className="bg-red-100 text-red-700 p-4 mt-auto rounded-xl">
              <p className="font-medium text-center text-sm">{mensajeError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Paquetes;