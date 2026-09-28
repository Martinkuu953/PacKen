import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';

// Asistente guiado para el administrador (rol empresa).
//
// Es un chat "dirigido": no se escribe texto libre, se elige entre opciones.
// Mira en qué punto de la puesta en marcha está la empresa (GET
// /api/auth/asistente) y propone el próximo paso, con el botón para ir a la
// pantalla donde se hace. Cada tema también se puede recorrer paso a paso.

// ── Temas: guías paso a paso ────────────────────────────────────────────────
const TEMAS = {
  ml: {
    titulo: 'Conectar Mercado Libre',
    ruta: '/sellers',
    pasos: [
      'Entrá a Sellers y tocá "Conectar con Mercado Libre".',
      'Te va a llevar a Mercado Libre: iniciá sesión con la cuenta del vendedor (seller) y aceptá los permisos.',
      'Mercado Libre te devuelve a PacKen. Si salió bien, el seller aparece en la tabla.',
      'Repetí lo mismo por cada vendedor con el que trabajes. Desde ese momento los estados de sus envíos se actualizan solos.',
    ],
  },
  zonas: {
    titulo: 'Zonas y barrios',
    ruta: '/zonas',
    pasos: [
      'Entrá a Establecer zonas. Ahí vas a ver tus zonas (por ejemplo Zona 1, 2 y 3).',
      'Tocá "Sincronizar barrios de Flex" para traer los barrios y municipios desde Mercado Libre (necesita al menos un seller conectado).',
      'Asigná cada barrio a una zona. La zona es lo que define la tarifa de cada paquete.',
      'Los barrios nuevos que aparezcan al escanear paquetes quedan "sin zona": volvé acá para asignarlos.',
    ],
  },
  listas: {
    titulo: 'Listas de precios y costos',
    ruta: '/listas',
    pasos: [
      'Entrá a Listas de precios/costos. Arriba elegís Sellers (lo que cobrás) o Transportistas (lo que pagás).',
      'Creá una lista con un nombre que no se repita (por ejemplo "Tarifa estándar").',
      'Abrí la lista y cargá el importe de cada zona. Con "Ajustar varias zonas" podés aplicar un aumento por porcentaje.',
      'Asigná la lista a cada seller (o transportista). Sin lista asignada no se puede facturar ni liquidar.',
      'Abajo de todo, en "Historial de cambios", queda registrado cada cambio de precio.',
    ],
  },
  transportistas: {
    titulo: 'Crear transportistas',
    ruta: '/transportistas',
    pasos: [
      'Entrá a Transportistas y completá "Nuevo transportista": nombre, email y una contraseña inicial.',
      'Pasale al transportista su email y contraseña. Con eso entra a PacKen desde el celular.',
      'Si se olvida la contraseña, la podés restablecer desde el detalle del transportista.',
      'Después asignale una lista de costos en Listas de precios/costos para poder liquidarle.',
    ],
  },
  paquetes: {
    titulo: 'Escanear y entregar paquetes',
    ruta: '/paquetes',
    pasos: [
      'El transportista entra a Paquetes y elige Colecta (cuando retira) o Reparto (cuando sale a entregar).',
      'Escanea el QR de la etiqueta de Mercado Libre. El paquete se carga solo con los datos del comprador.',
      'En tu pantalla de Paquetes podés reasignar cada paquete a otro transportista.',
      'Para cerrar varias entregas juntas: tildá los paquetes "En camino" y tocá "Entregar seleccionados".',
      'El botón "Historial" de cada paquete muestra todos sus cambios de estado: quién, cuándo y por dónde.',
    ],
  },
  cobros: {
    titulo: 'Facturas y liquidaciones',
    ruta: '/facturas',
    pasos: [
      'En Facturas generás lo que le cobrás a cada seller por los paquetes entregados en un período.',
      'En Liquidaciones generás lo que le pagás a cada transportista.',
      'Los dos usan la lista asignada y la zona de cada paquete. Si alguien figura "Sin lista", asignásela primero.',
    ],
  },
  seguridad: {
    titulo: 'Seguridad de la cuenta',
    ruta: '/perfil',
    pasos: [
      'Tu sesión no queda guardada en el navegador: si cerrás la pestaña, al volver se renueva sola de forma segura.',
      'Después de 5 contraseñas incorrectas seguidas, la cuenta se bloquea 15 minutos para frenar intentos de adivinarla.',
      'Desde Mi Perfil podés cambiar tu contraseña. Al hacerlo se cierran las sesiones abiertas en otros dispositivos.',
    ],
  },
};

// ── Checklist de puesta en marcha, en orden ─────────────────────────────────
function checklist(e) {
  return [
    {
      tema: 'ml',
      hecho: e.sellers.conectados > 0,
      detalle: e.sellers.total
        ? `${e.sellers.conectados} de ${e.sellers.total} seller(s) conectados`
        : 'Todavía no hay sellers',
    },
    {
      tema: 'zonas',
      hecho: e.zonas.total > 0 && e.barrios.total > 0 && e.barrios.sinZona === 0,
      detalle: e.barrios.total
        ? `${e.barrios.sinZona} barrio(s) sin zona de ${e.barrios.total}`
        : 'Todavía no hay barrios cargados',
    },
    {
      tema: 'listas',
      hecho: e.listas.precio > 0 && e.sellers.total > 0 && e.sellers.sinLista === 0,
      detalle: `${e.listas.precio} lista(s) de precios · ${e.sellers.sinLista} seller(s) sin lista`,
    },
    {
      tema: 'transportistas',
      hecho: e.transportistas.aceptados > 0,
      detalle: `${e.transportistas.aceptados} transportista(s) activos`,
    },
    {
      tema: 'listas',
      id: 'costos',
      hecho: e.listas.costo > 0 && e.transportistas.aceptados > 0 && e.transportistas.sinLista === 0,
      detalle: `${e.listas.costo} lista(s) de costos · ${e.transportistas.sinLista} transportista(s) sin lista`,
      titulo: 'Listas de costos para transportistas',
    },
    {
      tema: 'paquetes',
      hecho: e.paquetes.total > 0 && e.paquetes.sinTransportista === 0,
      detalle: e.paquetes.total
        ? `${e.paquetes.sinTransportista} paquete(s) abiertos sin transportista`
        : 'Todavía no se escaneó ningún paquete',
    },
  ];
}

let siguienteId = 0;
const msg = (de, contenido, opciones = []) => ({ id: siguienteId++, de, contenido, opciones });

const Asistente = () => {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, cargando]);

  const decir = (...nuevos) => setMensajes((prev) => [...prev, ...nuevos]);

  const opcionesMenu = [
    { label: '¿Qué hago ahora?', accion: { tipo: 'proximo' } },
    { label: 'Ver checklist', accion: { tipo: 'checklist' } },
    { label: 'Elegir un tema', accion: { tipo: 'temas' } },
  ];

  const obtenerEstado = useCallback(async () => {
    setCargando(true);
    try {
      return await apiFetch('/api/auth/asistente');
    } finally {
      setCargando(false);
    }
  }, []);

  const mostrarPaso = (temaId, indice) => {
    const tema = TEMAS[temaId];
    const ultimo = indice === tema.pasos.length - 1;
    const opciones = [
      { label: `Ir a ${tema.titulo}`, accion: { tipo: 'ir', ruta: tema.ruta } },
      ultimo
        ? { label: 'Listo, ¿qué sigue?', accion: { tipo: 'proximo' } }
        : { label: 'Siguiente paso', accion: { tipo: 'paso', tema: temaId, indice: indice + 1 } },
      { label: 'Volver al menú', accion: { tipo: 'menu' } },
    ];
    decir(msg('bot', <><strong>Paso {indice + 1} de {tema.pasos.length}:</strong> {tema.pasos[indice]}</>, opciones));
  };

  const ejecutar = async (accion, etiqueta) => {
    if (etiqueta) decir(msg('yo', etiqueta));

    switch (accion.tipo) {
      case 'menu':
        decir(msg('bot', '¿En qué te ayudo?', opcionesMenu));
        break;

      case 'temas':
        decir(msg(
          'bot',
          'Elegí un tema y te lo explico paso a paso:',
          Object.entries(TEMAS).map(([id, t]) => ({ label: t.titulo, accion: { tipo: 'paso', tema: id, indice: 0 } })),
        ));
        break;

      case 'paso':
        mostrarPaso(accion.tema, accion.indice);
        break;

      case 'ir':
        navigate(accion.ruta);
        decir(msg('bot', 'Listo, te llevé a esa pantalla. Cuando termines, seguimos.', [
          { label: 'Listo, ¿qué sigue?', accion: { tipo: 'proximo' } },
          { label: 'Volver al menú', accion: { tipo: 'menu' } },
        ]));
        break;

      case 'checklist':
      case 'proximo': {
        let estado;
        try {
          estado = await obtenerEstado();
        } catch (err) {
          decir(msg('bot', `No pude revisar tu cuenta: ${err.message}`, opcionesMenu));
          break;
        }
        const items = checklist(estado);

        if (accion.tipo === 'checklist') {
          decir(msg(
            'bot',
            <ul className="space-y-1">
              {items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true">{it.hecho ? '✅' : '⬜'}</span>
                  <span>
                    <span className="font-medium">{it.titulo ?? TEMAS[it.tema].titulo}</span>
                    <span className="block text-xs text-gray-500">{it.detalle}</span>
                  </span>
                </li>
              ))}
            </ul>,
            [{ label: '¿Qué hago ahora?', accion: { tipo: 'proximo' } }, { label: 'Volver al menú', accion: { tipo: 'menu' } }],
          ));
          break;
        }

        const pendiente = items.find((it) => !it.hecho);
        if (!pendiente) {
          decir(msg(
            'bot',
            '¡Tu cuenta está completa! 🎉 Ya podés facturar a tus sellers y liquidar a tus transportistas.',
            [
              { label: 'Cómo facturar y liquidar', accion: { tipo: 'paso', tema: 'cobros', indice: 0 } },
              { label: 'Volver al menú', accion: { tipo: 'menu' } },
            ],
          ));
          break;
        }

        const tema = TEMAS[pendiente.tema];
        decir(msg(
          'bot',
          <>
            Tu próximo paso: <strong>{pendiente.titulo ?? tema.titulo}</strong>.
            <span className="block text-xs text-gray-500 mt-1">{pendiente.detalle}</span>
          </>,
          [
            { label: 'Guiame paso a paso', accion: { tipo: 'paso', tema: pendiente.tema, indice: 0 } },
            { label: `Ir a ${tema.titulo}`, accion: { tipo: 'ir', ruta: tema.ruta } },
            { label: 'Volver al menú', accion: { tipo: 'menu' } },
          ],
        ));
        break;
      }

      default:
        break;
    }
  };

  const abrir = () => {
    setAbierto(true);
    if (mensajes.length === 0) {
      decir(msg('bot', '¡Hola! Soy el asistente de PacKen. Te acompaño paso a paso para dejar tu cuenta andando.', opcionesMenu));
    }
  };

  // Solo el último mensaje del bot tiene opciones activas: las viejas quedan
  // como registro de la conversación pero no se pueden volver a tocar.
  const ultimoConOpciones = [...mensajes].reverse().find((m) => m.de === 'bot')?.id;

  return (
    <>
      {!abierto && (
        <button
          onClick={abrir}
          className="fixed bottom-4 right-4 z-40 px-4 py-3 rounded-full shadow-lg bg-marca-grafito text-white text-sm font-semibold hover:opacity-90"
          aria-label="Abrir asistente"
        >
          💬 Asistente
        </button>
      )}

      {abierto && (
        <section
          aria-label="Asistente de PacKen"
          className="fixed z-40 bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-96 h-[75vh] sm:h-[32rem] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
        >
          <header className="flex items-center justify-between px-4 py-3 bg-marca-amarillo sm:rounded-t-2xl">
            <p className="font-bold text-marca-grafito">Asistente PacKen</p>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar asistente"
              className="text-2xl leading-none text-marca-grafito/70 hover:text-marca-grafito"
            >
              ×
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
            {mensajes.map((m) => (
              <div key={m.id} className={m.de === 'yo' ? 'flex justify-end' : ''}>
                <div
                  className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                    m.de === 'yo' ? 'bg-marca-oro text-marca-grafito' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.contenido}
                </div>
                {m.id === ultimoConOpciones && m.opciones.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.opciones.map((o) => (
                      <button
                        key={o.label}
                        disabled={cargando}
                        onClick={() => ejecutar(o.accion, o.label)}
                        className="text-xs px-3 py-1.5 rounded-full border border-marca-oro text-marca-grafito hover:bg-marca-crema disabled:opacity-50"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {cargando && <p className="text-xs text-gray-400">Revisando tu cuenta...</p>}
            <div ref={finRef} />
          </div>
        </section>
      )}
    </>
  );
};

export default Asistente;
