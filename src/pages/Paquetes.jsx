import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const Paquetes = () => {
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    // 1. Configuramos el "motor" del escáner
    const scanner = new Html5QrcodeScanner(
      "lector-camara", // El ID del div donde va a aparecer el video
      {
        fps: 10, // Cuadros por segundo (10 es un buen balance de velocidad/rendimiento)
        qrbox: { width: 250, height: 250 }, // El cuadradito de enfoque
        rememberLastUsedCamera: true, // Recuerda si usaste la frontal o la trasera
      },
      false // Oculta mensajes en la consola de desarrollo
    );

    // 2. ¿Qué hacemos cuando lee un código correctamente?
    const alEscanearConExito = (textoDecodificado) => {
      setResultado(textoDecodificado);
      // Opcional: pausamos el escáner para que no lea la misma etiqueta 20 veces por segundo
      scanner.pause(); 
    };

    // 3. ¿Qué hacemos si hay error? (Es normal que tire errores mientras intenta enfocar)
    const alFallarEscaneo = (error) => {
      // Lo dejamos vacío para no saturar la consola, está constantemente buscando
    };

    // 4. Prendemos la cámara
    scanner.render(alEscanearConExito, alFallarEscaneo);

    // 5. Limpieza: Si el usuario cambia a la pestaña "Liquidaciones", apagamos la cámara
    return () => {
      scanner.clear().catch(error => console.error("Error al apagar la cámara", error));
    };
  }, []);

  // Función para resetear y seguir escaneando
  const escanearNuevo = () => {
    setResultado(null);
    // Para reanudar el escáner si lo habíamos pausado, lo más seguro es recargar el componente, 
    // pero por ahora limpiamos el estado.
    window.location.reload(); 
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          📷 Ingreso a Depósito (Cross-Docking)
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Columna Izquierda: La Cámara */}
          <div className="flex flex-col items-center">
            {/* ESTE DIV es donde la librería va a inyectar el video en vivo */}
            <div id="lector-camara" className="w-full max-w-sm rounded-xl overflow-hidden border-4 border-yellow-400 shadow-md"></div>
            <p className="text-gray-500 text-sm mt-4 text-center font-medium">
              Apuntá el código de barras o QR de la etiqueta hacia la cámara.
            </p>
          </div>

          {/* Columna Derecha: El Resultado y Acciones */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col justify-center min-h-[300px]">
            <h3 className="text-gray-600 font-bold uppercase tracking-wider text-sm mb-4 text-center">
              Último Paquete Escaneado
            </h3>

            {resultado ? (
              <div className="space-y-6 flex flex-col items-center">
                <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-lg w-full text-center">
                  <p className="text-xs text-green-600 font-bold uppercase mb-1">ID de Envío (Mercado Libre)</p>
                  <p className="font-mono text-2xl font-black break-all">{resultado}</p>
                </div>
                
                <p className="text-sm text-gray-600 text-center">
                  En el próximo paso, este código se cruzará con Supabase para asignar la zona automáticamente.
                </p>

                <button 
                  onClick={escanearNuevo}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  📥 Escanear Siguiente
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                <div className="w-16 h-16 border-4 border-dashed border-gray-400 rounded-lg animate-pulse"></div>
                <p className="text-gray-500 font-semibold">Esperando lectura...</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Paquetes;