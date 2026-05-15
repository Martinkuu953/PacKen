import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../supabaseClient';

const Paquetes = () => {
  // Estado para saber en qué pantalla estamos: null | 'colecta' | 'reparto'
  const [modo, setModo] = useState(null); 
  
  const [resultado, setResultado] = useState(null);
  const [zonaAsignada, setZonaAsignada] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');

  // 1. Validación manual del código (sin Regex)
  const validarCodigoManual = (codigo) => {
    if (!codigo || codigo.length < 8 || codigo.length > 20) return false;
    const caracteresPermitidos = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-";
    for (let i = 0; i < codigo.length; i++) {
      let esValido = false;
      for (let j = 0; j < caracteresPermitidos.length; j++) {
        if (codigo[i] === caracteresPermitidos[j]) {
          esValido = true;
          break;
        }
      }
      if (!esValido) return false; 
    }
    return true;
  };

  // 2. Función que procesa la lectura y guarda en Supabase según el Modo
  const procesarEscaneo = async (textoDecodificado, scannerInstance) => {
    if (procesando) return;
    if (scannerInstance) scannerInstance.pause();
    
    setProcesando(true);
    setMensajeError('');
    setZonaAsignada(null);

    if (!validarCodigoManual(textoDecodificado)) {
      setMensajeError('Formato inválido. Volvé a escanear.');
      setProcesando(false);
      return;
    }

    setResultado(textoDecodificado);

    try {
      // Preparamos los datos base del paquete
      const paqueteData = {
        IdEnvioML: textoDecodificado,
        IdSeller: 1, // MVP: Dato fijo
        IdZona: 1,   // MVP: Dato fijo
        // Si es colecta, recién ingresa. Si es reparto, ya está en camino.
        Estado: modo === 'colecta' ? 'Ingresado' : 'En camino' 
      };

      // LA MAGIA DE LA ASIGNACIÓN: 
      // Solo le asignamos transportista si el usuario eligió "Reparto"
      if (modo === 'reparto') {
        paqueteData.IdTransportista = 1; // MVP: ID fijo del transportista logueado
      }

      const { error } = await supabase
        .from('Paquete')
        .insert([paqueteData]);

      if (error) throw error;

      setZonaAsignada("ZONA 1");

    } catch (err) {
      console.error("Error de Supabase:", err);
      setMensajeError("Error al guardar. Revisá tu conexión.");
    } finally {
      setProcesando(false);
    }
  };

  // 3. Control del Escáner (Se prende solo si hay un modo seleccionado)
  useEffect(() => {
    let scanner;
    if (modo) {
      scanner = new Html5QrcodeScanner(
        "lector-camara",
        { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
        false
      );
      
      scanner.render(
        (texto) => procesarEscaneo(texto, scanner), 
        () => {} // Ignoramos fallos de enfoque
      );
    }

    // Limpieza al desmontar o volver atrás
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [modo]); // Se vuelve a ejecutar si cambia el modo

  const resetearEscaneo = () => {
    setResultado(null);
    setZonaAsignada(null);
    setMensajeError('');
    // Al setear el modo de nuevo, el useEffect reinicia la cámara automáticamente
    const modoActual = modo;
    setModo(null);
    setTimeout(() => setModo(modoActual), 50); 
  };

  // --- INTERFAZ 1: SELECCIÓN DE MODO (Mobile First) ---
  if (!modo) {
    return (
      <div className="max-w-md mx-auto min-h-[80vh] flex flex-col items-center justify-center p-4">
        <h2 className="text-3xl font-bold text-gray-800 mb-10 text-center">
          ¿Qué vas a escanear?
        </h2>
        
        <div className="w-full space-y-6">
          <button 
            onClick={() => setModo('colecta')}
            className="w-full bg-white border-2 border-gray-200 text-gray-800 text-2xl font-bold py-8 rounded-3xl shadow-sm hover:border-yellow-400 active:scale-95 transition-all"
          >
            Colecta
          </button>
          
          <button 
            onClick={() => setModo('reparto')}
            className="w-full bg-white border-2 border-gray-200 text-gray-800 text-2xl font-bold py-8 rounded-3xl shadow-sm hover:border-yellow-400 active:scale-95 transition-all"
          >
            Reparto
          </button>
        </div>
      </div>
    );
  }

  // --- INTERFAZ 2: ESCÁNER ACTIVO ---
  return (
    <div className="max-w-md mx-auto p-4 flex flex-col min-h-screen">
      {/* Botón Volver y Título */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setModo(null)}
          className="text-gray-600 font-bold p-2 text-xl"
        >
          ← 
        </button>
        <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
          {modo === 'colecta' ? 'Modo Colecta' : 'Modo Reparto'}
        </h2>
      </div>

      {/* Contenedor de la Cámara */}
      <div className="flex flex-col items-center mb-6">
        <div id="lector-camara" className="w-full rounded-2xl overflow-hidden shadow-md bg-black border-4 border-yellow-400"></div>
      </div>

      {/* Panel de Resultados Integrado */}
      <div className="flex-1 bg-white rounded-t-3xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)] p-6 -mx-4 border-t border-gray-100 flex flex-col justify-center">
        {procesando ? (
          <div className="flex flex-col items-center justify-center text-yellow-600">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500 mb-4"></div>
            <p className="font-bold">Guardando en la nube...</p>
          </div>
        ) : zonaAsignada ? (
          <div className="space-y-4 flex flex-col items-center animate-fade-in">
            <div className="bg-green-500 text-white p-4 rounded-xl w-full text-center shadow-md">
              <p className="text-xs font-bold uppercase mb-1 opacity-90">ID: {resultado}</p>
              <p className="text-4xl font-black">{zonaAsignada}</p>
            </div>
            <p className="text-gray-600 text-sm font-medium">¡Guardado con éxito!</p>
            <button 
              onClick={resetearEscaneo}
              className="w-full bg-yellow-400 text-gray-900 text-lg font-bold py-4 rounded-full shadow-sm active:scale-95 transition-all"
            >
              Escanear Próximo
            </button>
          </div>
        ) : mensajeError ? (
          <div className="space-y-4 flex flex-col items-center">
            <div className="bg-red-100 text-red-700 p-4 rounded-xl w-full text-center">
              <p className="font-bold">{mensajeError}</p>
            </div>
            <button onClick={resetearEscaneo} className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-full">Reintentar</button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-50">
            <p className="text-gray-500 font-semibold text-center">Enfocá el código de barras en el centro de la pantalla.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Paquetes;