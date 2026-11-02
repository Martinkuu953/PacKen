import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { ErrorPublico, responderError } from '../errores.js';
import { LIMITES, verificarLimites, registrarIntento } from '../rateLimit.js';
import { crearServidorMcp, PANTALLAS } from './mcp.js';

// POST /api/auth/asistente-chat — el asistente de texto libre.
//
// El usuario escribe lo que quiere hacer; Claude lo resuelve usando las
// herramientas del servidor MCP de PacKen (mcp.js), al que este handler se
// conecta como cliente MCP dentro de la misma función (transporte en memoria:
// no hay un puerto ni una URL pública que proteger).
//
// Es sin estado, como toda Serverless Function: la conversación (en el formato
// de la API de Claude) la guarda el navegador y viaja entera en cada pedido.
// Que el cliente pueda reescribirla no da permisos de más: toda herramienta
// corre con el token del usuario contra los mismos handlers que la UI.
//
// Las consultas se ejecutan solas. Ante una herramienta que modifica datos el
// handler corta, devuelve la acción `pendiente` y espera la decisión del
// usuario en el próximo pedido ({ decision: 'confirmar' | 'cancelar' }).
//
// Body: { mensajes, texto? , decision? }
// Respuesta: { mensajes, respuesta, pendiente, pantallas }

const MODELO = 'claude-opus-5-5';
// Cada vuelta es una llamada a Claude; el maxDuration de la función es 60s.
const MAX_VUELTAS = 6;
const PRESUPUESTO_MS = 45_000;
const MAX_TEXTO = 2000;
// Tope de la conversación entera. No se recorta por el principio: editar el
// historial invalida los bloques de razonamiento que la API exige devolver tal
// cual, así que pasado este tamaño se pide empezar una conversación nueva.
const MAX_CONVERSACION_BYTES = 400_000;

let cliente = null;
const claude = () => (cliente ??= new Anthropic());

// Modo de prueba sin costo: con PACKEN_ASISTENTE_MOCK=1 no se llama a la API de
// Claude (no hace falta ANTHROPIC_API_KEY). Se simula solo el razonamiento del
// modelo; las herramientas MCP corren igual contra la cuenta con el token del
// usuario, así se prueba toda la mecánica (MCP, ejecución, confirmación, UI) de
// punta a punta. Escribí "demo-accion" para probar el camino de confirmación.
const MODO_MOCK = process.env.PACKEN_ASISTENTE_MOCK === '1';

function respuestaMock(mensajes) {
  const ultimo = mensajes.at(-1);
  const hayResultado = Array.isArray(ultimo?.content) && ultimo.content.some((b) => b.type === 'tool_result');
  if (hayResultado) {
    return {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '(demo) Ejecuté la herramienta; esta respuesta es simulada. Configurá ANTHROPIC_API_KEY para usar el asistente real.' }],
    };
  }
  const texto = typeof ultimo?.content === 'string' ? ultimo.content.toLowerCase() : '';
  if (texto.includes('demo-accion')) {
    return {
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: '(demo) Voy a crear la lista de precios "Demo".' },
        { type: 'tool_use', id: `mock_${Date.now()}`, name: 'crear_lista', input: { nombre: 'Demo', tipo: 'precio' } },
      ],
    };
  }
  return {
    stop_reason: 'tool_use',
    content: [
      { type: 'text', text: '(demo) Consulto el estado de la cuenta.' },
      { type: 'tool_use', id: `mock_${Date.now()}`, name: 'estado_cuenta', input: {} },
    ],
  };
}

function sistema() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  return `Sos el asistente de PacKen, el sistema con el que una empresa de logística gestiona envíos Flex de Mercado Libre: sellers (los vendedores a los que les cobra), transportistas (a los que les paga), paquetes, zonas, barrios y listas de precios y costos. Hablás con el administrador de la empresa, en español rioplatense, de forma breve y concreta. Hoy es ${hoy} (hora de Argentina).

Usá las herramientas para responder con datos reales de la cuenta; nunca inventes cifras ni ids. Si el usuario nombra un seller, transportista, lista, zona o barrio, buscá su id con la herramienta de consulta que corresponda. Si hay más de una coincidencia posible o falta un dato, preguntá antes de actuar.

Las herramientas que modifican datos las confirma el usuario con un botón antes de ejecutarse. Antes de llamar a una, escribí en una oración qué vas a cambiar con los nombres y valores concretos (por ejemplo: "Voy a subir 10% las zonas 1 y 2 de la lista Estándar: $1.000 → $1.100 y $1.500 → $1.650."). Si el usuario cancela, no insistas.

Lo que no podés hacer vos (facturar, liquidar, borrar, crear transportistas, conectar Mercado Libre, escanear) explicalo en una o dos frases y ofrecé la pantalla con abrir_pantalla.

Respondé en texto plano, sin markdown ni tablas: el chat es chico. Los importes van en pesos con formato argentino ($1.234,50).`;
}

// Las herramientas MCP en el formato de la API de Claude.
//
// El prompt de sistema y estas herramientas no cambian dentro del día (el
// sistema solo lleva la fecha), así que se marca la última herramienta con
// cache_control: a partir de la 2ª vuelta de un pedido —y del 2º mensaje de la
// conversación— la API cobra esa parte como lectura de caché (~10% del precio)
// en vez de reenviarla entera. El bloque cacheado cubre system + todas las
// herramientas porque van antes que los mensajes.
function herramientasParaClaude(tools) {
  const lista = tools.map((t) => {
    const esquema = { ...(t.inputSchema ?? { type: 'object', properties: {} }) };
    delete esquema.$schema;
    return { name: t.name, description: t.description ?? t.title ?? t.name, input_schema: esquema };
  });
  if (lista.length) lista[lista.length - 1].cache_control = { type: 'ephemeral' };
  return lista;
}

function validarConversacion(mensajes) {
  if (!Array.isArray(mensajes)) throw new ErrorPublico('Conversación inválida');
  for (const m of mensajes) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) throw new ErrorPublico('Conversación inválida');
  }
  if (mensajes.length && mensajes[0].role !== 'user') throw new ErrorPublico('Conversación inválida');
  if (JSON.stringify(mensajes).length > MAX_CONVERSACION_BYTES) {
    throw new ErrorPublico('La conversación es muy larga. Tocá "Borrar historial" para empezar una nueva.', 413);
  }
}

const usosDeHerramientas = (mensaje) =>
  mensaje?.role === 'assistant' && Array.isArray(mensaje.content)
    ? mensaje.content.filter((b) => b.type === 'tool_use')
    : [];

const textoDe = (contenido) =>
  (Array.isArray(contenido) ? contenido : [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

async function ejecutarHerramientas(mcp, usos, { cancelar = new Set() } = {}) {
  return Promise.all(
    usos.map(async (uso) => {
      if (cancelar.has(uso.name)) {
        return {
          type: 'tool_result',
          tool_use_id: uso.id,
          content: 'El usuario canceló esta acción. No se hizo ningún cambio.',
          is_error: true,
        };
      }
      try {
        const r = await mcp.callTool({ name: uso.name, arguments: uso.input ?? {} });
        const texto = (r.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
        return { type: 'tool_result', tool_use_id: uso.id, content: texto || 'OK', is_error: Boolean(r.isError) };
      } catch (err) {
        return { type: 'tool_result', tool_use_id: uso.id, content: `Error: ${err.message}`, is_error: true };
      }
    }),
  );
}

// Las pantallas que el asistente ofreció abrir en este pedido, para dibujar
// los botones.
function pantallasOfrecidas(mensajes, desde) {
  const rutas = new Set();
  for (const m of mensajes.slice(desde)) {
    for (const uso of usosDeHerramientas(m)) {
      if (uso.name === 'abrir_pantalla' && PANTALLAS[uso.input?.ruta]) rutas.add(uso.input.ruta);
    }
  }
  return [...rutas].map((ruta) => ({ ruta, titulo: PANTALLAS[ruta] }));
}

export async function conversar(token, body) {
  const mensajes = Array.isArray(body.mensajes) ? [...body.mensajes] : [];
  validarConversacion(mensajes);
  const inicioDelPedido = mensajes.length;

  const servidor = crearServidorMcp(token);
  const mcp = new Client({ name: 'asistente-packen', version: '1.0.0' });
  const [lado1, lado2] = InMemoryTransport.createLinkedPair();
  await Promise.all([servidor.connect(lado1), mcp.connect(lado2)]);

  try {
    const { tools } = await mcp.listTools();
    const soloLectura = new Set(tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name));
    const titulos = new Map(tools.map((t) => [t.name, t.title ?? t.name]));
    const herramientas = herramientasParaClaude(tools);

    const pendientes = usosDeHerramientas(mensajes.at(-1));

    if (body.decision) {
      if (!pendientes.length) throw new ErrorPublico('No hay ninguna acción esperando confirmación');
      if (body.decision !== 'confirmar' && body.decision !== 'cancelar') throw new ErrorPublico('Decisión inválida');
      const cancelar = body.decision === 'cancelar'
        ? new Set(pendientes.map((u) => u.name).filter((n) => !soloLectura.has(n)))
        : new Set();
      mensajes.push({ role: 'user', content: await ejecutarHerramientas(mcp, pendientes, { cancelar }) });
    } else {
      const texto = String(body.texto ?? '').trim();
      if (!texto) throw new ErrorPublico('Escribí qué querés hacer');
      if (texto.length > MAX_TEXTO) throw new ErrorPublico(`El mensaje es muy largo (máximo ${MAX_TEXTO} caracteres)`);
      if (pendientes.length) throw new ErrorPublico('Primero confirmá o cancelá la acción pendiente');
      mensajes.push({ role: 'user', content: texto });
    }

    const inicio = Date.now();
    for (let vuelta = 0; vuelta < MAX_VUELTAS && Date.now() - inicio < PRESUPUESTO_MS; vuelta++) {
      const respuesta = MODO_MOCK ? respuestaMock(mensajes) : await claude().beta.messages.create({
        model: MODELO,
        // Las respuestas son texto corto; una vuelta con varias llamadas a
        // herramientas entra de sobra. Un tope bajo no cambia lo que se cobra
        // (solo se paga lo generado) pero acota el peor caso.
        max_tokens: 2048,
        // Chat corto y con herramientas: a esfuerzo bajo responde rápido y
        // alcanza para resolver qué consultar.
        output_config: { effort: 'low' },
        // Si un clasificador de seguridad rechaza el pedido, la API lo
        // reintenta sola en el modelo recomendado para ese caso.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // Prompt de sistema cacheado (estable dentro del día). Las herramientas
        // llevan su propio cache_control en herramientasParaClaude().
        system: [{ type: 'text', text: sistema(), cache_control: { type: 'ephemeral' } }],
        tools: herramientas,
        messages: mensajes,
      });

      if (respuesta.stop_reason === 'refusal') {
        return {
          mensajes,
          respuesta: 'No puedo ayudarte con ese pedido. Probá reformularlo o usá las pantallas del menú.',
          pendiente: null,
          pantallas: [],
        };
      }

      mensajes.push({ role: 'assistant', content: respuesta.content });
      const usos = usosDeHerramientas(mensajes.at(-1));

      if (respuesta.stop_reason !== 'tool_use' || !usos.length) {
        return {
          mensajes,
          respuesta: textoDe(respuesta.content) || 'Listo.',
          pendiente: null,
          pantallas: pantallasOfrecidas(mensajes, inicioDelPedido),
        };
      }

      const acciones = usos.filter((u) => !soloLectura.has(u.name));
      if (acciones.length) {
        return {
          mensajes,
          respuesta: textoDe(respuesta.content),
          pendiente: acciones.map((u) => ({ titulo: titulos.get(u.name) ?? u.name, datos: u.input })),
          pantallas: pantallasOfrecidas(mensajes, inicioDelPedido),
        };
      }

      mensajes.push({ role: 'user', content: await ejecutarHerramientas(mcp, usos) });
    }

    // Se terminaron las vueltas con resultados de herramientas sin responder:
    // la conversación queda válida (el próximo mensaje del usuario se suma a
    // ese mismo turno) y se avisa.
    return {
      mensajes,
      respuesta: 'Me llevó demasiados pasos. Probá con un pedido más concreto.',
      pendiente: null,
      pantallas: pantallasOfrecidas(mensajes, inicioDelPedido),
    };
  } finally {
    await mcp.close().catch(() => {});
    await servidor.close().catch(() => {});
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  try {
    if (!MODO_MOCK && !process.env.ANTHROPIC_API_KEY) {
      throw new ErrorPublico('El asistente no está configurado (falta ANTHROPIC_API_KEY en el servidor).', 503);
    }

    // Cada mensaje es una o varias llamadas pagas a Claude.
    const supabase = getSupabase();
    const clave = `asistente:${usuario.id}`;
    await verificarLimites(supabase, [{ clave, ...LIMITES.asistentePorUsuario }]);
    await registrarIntento(supabase, [clave]);

    const token = req.headers.authorization.slice('Bearer '.length);
    return res.json(await conversar(token, req.body ?? {}));
  } catch (err) {
    // El error real de la API de Claude queda en el log; al usuario le llega
    // uno legible.
    if (err instanceof Anthropic.APIError) console.error('[PacKen] Error de la API de Claude:', err);
    if (err instanceof Anthropic.RateLimitError) {
      return responderError(res, new ErrorPublico('El asistente está saturado. Probá en un minuto.', 429), 429, 'asistente-chat');
    }
    if (err instanceof Anthropic.APIError) {
      return responderError(res, new ErrorPublico('El asistente no está disponible en este momento.', 502), 502, 'asistente-chat');
    }
    return responderError(res, err, 500, 'asistente-chat');
  }
}
