import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { invocar } from './invocar.js';
import { ESTADOS_VALIDOS } from '../../../shared/estados.js';
import paquetes from '../../paquetes/index.js';
import sellers from '../../sellers/index.js';
import transportistas from '../../transportistas/index.js';
import precios from '../../precios/index.js';
import costos from '../../costos/index.js';
import reasignar from '../paquetes/reasignar.js';
import estadoCuenta from '../auth/asistente.js';

// Servidor MCP de PacKen: las herramientas que el asistente puede usar.
//
// Se arma uno por request, atado al token del usuario que pregunta: cada
// herramienta llama al handler de /api correspondiente con ese token (ver
// invocar.js), así que el alcance es exactamente el de la empresa logueada.
//
// readOnlyHint separa las consultas de las acciones: el chat (chat.js) ejecuta
// las consultas solo, y frena antes de cualquier herramienta que modifique
// datos hasta que el usuario la confirme.
//
// Lo que tiene consecuencias difíciles de deshacer (borrar, facturar, liquidar,
// crear cuentas con contraseña) queda fuera a propósito: para eso el asistente
// ofrece abrir la pantalla.

export const PANTALLAS = {
  '/': 'Inicio',
  '/paquetes': 'Paquetes',
  '/sellers': 'Sellers',
  '/transportistas': 'Transportistas',
  '/listas': 'Listas de precios/costos',
  '/zonas': 'Establecer zonas',
  '/estadisticas': 'Estadísticas',
  '/facturas': 'Facturas',
  '/liquidaciones': 'Liquidaciones',
  '/perfil': 'Mi perfil',
};

const LECTURA = { readOnlyHint: true };
const ESCRITURA = { readOnlyHint: false, destructiveHint: false };

const resultado = (datos) => ({ content: [{ type: 'text', text: JSON.stringify(datos) }] });

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe('Fecha YYYY-MM-DD (hora de Argentina)');
const uuid = (que) => z.string().uuid().describe(`id de ${que}, tal como lo devuelven las herramientas de consulta`);
const tipoLista = z
  .enum(['precio', 'costo'])
  .describe('"precio" = lo que se le cobra a los sellers; "costo" = lo que se le paga a los transportistas');

const filtrosPaquetes = {
  estado: z.enum(ESTADOS_VALIDOS).optional(),
  sellerId: uuid('seller').optional(),
  transportistaId: uuid('transportista').optional(),
  desde: fecha.optional().describe('Ingresados desde este día (YYYY-MM-DD)'),
  hasta: fecha.optional().describe('Ingresados hasta este día inclusive (YYYY-MM-DD)'),
};

// Los filtros vacíos no viajan: el handler trata '' y undefined distinto.
const sinVacios = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));

export function crearServidorMcp(token) {
  const servidor = new McpServer({ name: 'packen', version: '1.0.0' });
  const llamar = (handler, opciones) => invocar(handler, { token, ...opciones });

  // Las listas de precios y de costos comparten forma; cambia el endpoint.
  const endpointLista = (tipo) => (tipo === 'costo' ? costos : precios);
  const operarLista = (tipo, body) => llamar(endpointLista(tipo), { method: 'POST', body });

  // ── Consultas ─────────────────────────────────────────────────────────────

  servidor.registerTool(
    'estado_cuenta',
    {
      title: 'Estado de la cuenta',
      description:
        'Cuánto falta para dejar la cuenta andando: sellers conectados a Mercado Libre y sin lista, ' +
        'transportistas sin lista de costos, barrios sin zona, listas creadas y paquetes abiertos sin transportista.',
      annotations: LECTURA,
    },
    async () => resultado(await llamar(estadoCuenta)),
  );

  servidor.registerTool(
    'resumen_paquetes',
    {
      title: 'Cantidad de paquetes por estado',
      description: 'Cuenta los paquetes por estado, con filtros opcionales. Para preguntas de "cuántos".',
      inputSchema: filtrosPaquetes,
      annotations: LECTURA,
    },
    async (filtros) =>
      resultado(await llamar(paquetes, { query: { ...sinVacios(filtros), vista: 'resumen' } })),
  );

  servidor.registerTool(
    'buscar_paquetes',
    {
      title: 'Buscar paquetes',
      description:
        'Lista paquetes (los más recientes primero) con filtros y búsqueda por texto en el ID de envío ' +
        'de Mercado Libre, el comprador o la dirección (mínimo 3 caracteres). Devuelve el total y una página.',
      inputSchema: {
        ...filtrosPaquetes,
        texto: z.string().max(80).optional(),
        pagina: z.number().int().min(1).optional(),
        limite: z.number().int().min(1).max(50).optional().describe('Por defecto 20'),
      },
      annotations: LECTURA,
    },
    async ({ texto, pagina, limite, ...filtros }) => {
      const res = await llamar(paquetes, {
        query: sinVacios({ ...filtros, q: texto, pagina, limite: limite ?? 20 }),
      });
      return resultado({
        total: res.total,
        pagina: res.pagina,
        paquetes: res.paquetes.map((p) => ({
          id: p.id,
          envioML: p.idenvioml,
          estado: p.estado,
          comprador: p.comprador,
          direccion: p.direccion,
          partido: p.partido,
          zona: p.zona,
          seller: p.seller,
          transportista: p.transportista,
          transportistaId: p.transportistaId,
          ingreso: p.fechaingreso,
          entrega: p.fechaentrega,
        })),
      });
    },
  );

  servidor.registerTool(
    'historial_paquete',
    {
      title: 'Historial de un paquete',
      description: 'Los cambios de estado de un paquete: de qué a qué, cuándo, quién y por qué vía.',
      inputSchema: { paqueteId: uuid('paquete') },
      annotations: LECTURA,
    },
    async ({ paqueteId }) => resultado(await llamar(paquetes, { query: { historial: paqueteId } })),
  );

  servidor.registerTool(
    'estadisticas_por_partido',
    {
      title: 'Estadísticas por partido',
      description: 'Paquetes agrupados por partido/barrio y estado, con los mismos filtros que buscar_paquetes.',
      inputSchema: filtrosPaquetes,
      annotations: LECTURA,
    },
    async (filtros) =>
      resultado(await llamar(paquetes, { query: { ...sinVacios(filtros), vista: 'estadisticas' } })),
  );

  servidor.registerTool(
    'listar_sellers',
    {
      title: 'Sellers',
      description:
        'Los sellers de la empresa con sus paquetes por estado. "monto" es el total de TODOS sus ' +
        'entregados valorizado con la tarifa actual: no es lo facturado ni lo de un período.',
      annotations: LECTURA,
    },
    async () => resultado(await llamar(sellers)),
  );

  servidor.registerTool(
    'listar_transportistas',
    {
      title: 'Transportistas',
      description:
        'Los transportistas de la empresa con sus paquetes por estado. "monto" es el total de TODOS sus ' +
        'entregados valorizado con la tarifa de costos actual: no es lo liquidado ni lo de un período.',
      annotations: LECTURA,
    },
    async () => {
      // El DNI no se le pasa al modelo: no hace falta para nada que el
      // asistente pueda hacer, y es un dato personal del transportista.
      const res = await llamar(transportistas);
      return resultado({
        montoTotal: res.montoTotal,
        transportistas: res.transportistas.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          totales: t.totales,
          enCamino: t.enCamino,
          entregados: t.entregados,
          cancelados: t.cancelados,
          reprogramados: t.reprogramados,
          monto: t.monto,
        })),
      });
    },
  );

  servidor.registerTool(
    'listar_listas',
    {
      title: 'Listas de precios o costos',
      description:
        'Las listas de un tipo con el importe de cada zona, las zonas de la empresa y a qué lista está ' +
        'asignado cada seller (precio) o transportista (costo).',
      inputSchema: { tipo: tipoLista },
      annotations: LECTURA,
    },
    async ({ tipo }) => {
      const res = await llamar(endpointLista(tipo));
      const zonaNombre = new Map(res.zonas.map((z) => [z.id, z.nombre]));
      const listaNombre = new Map(res.listas.map((l) => [l.id, l.nombre]));
      return resultado({
        zonas: res.zonas.map((z) => ({ id: z.id, nombre: z.nombre })),
        listas: res.listas.map((l) => ({
          id: l.id,
          nombre: l.nombre,
          tarifas: l.tarifas.map((t) => ({ zonaId: t.zonaId, zona: zonaNombre.get(t.zonaId), importe: t.importe })),
          barriosConZonaPropia: l.areas.length,
        })),
        [tipo === 'costo' ? 'transportistas' : 'sellers']: res.entidades.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          lista: e.listaId ? listaNombre.get(e.listaId) ?? null : null,
        })),
      });
    },
  );

  servidor.registerTool(
    'listar_barrios',
    {
      title: 'Barrios y su zona',
      description: 'Los barrios/partidos de Flex de la empresa con su zona por defecto.',
      inputSchema: {
        soloSinZona: z.boolean().optional(),
        texto: z.string().max(80).optional().describe('Filtra por nombre'),
        limite: z.number().int().min(1).max(200).optional().describe('Por defecto 100'),
      },
      annotations: LECTURA,
    },
    async ({ soloSinZona, texto, limite = 100 }) => {
      const res = await llamar(precios);
      const zonaNombre = new Map(res.zonas.map((z) => [z.id, z.nombre]));
      const buscado = texto?.toLowerCase();
      const filtrados = res.areas.filter(
        (a) => (!soloSinZona || !a.zonaId) && (!buscado || a.nombre.toLowerCase().includes(buscado)),
      );
      return resultado({
        total: filtrados.length,
        barrios: filtrados.slice(0, limite).map((a) => ({
          id: a.id,
          nombre: a.nombre,
          zona: a.zonaId ? zonaNombre.get(a.zonaId) ?? null : null,
        })),
      });
    },
  );

  servidor.registerTool(
    'abrir_pantalla',
    {
      title: 'Abrir una pantalla',
      description:
        'Le ofrece al usuario un botón para ir a una pantalla de PacKen. Usala para lo que no podés hacer ' +
        'vos (facturar, liquidar, borrar, crear transportistas, conectar Mercado Libre, escanear).',
      inputSchema: { ruta: z.enum(Object.keys(PANTALLAS)) },
      annotations: LECTURA,
    },
    async ({ ruta }) => resultado({ ok: true, boton: PANTALLAS[ruta] }),
  );

  // ── Acciones (requieren confirmación del usuario) ─────────────────────────

  servidor.registerTool(
    'crear_seller',
    {
      title: 'Crear seller',
      description: 'Da de alta un seller. Para que sus envíos se puedan escanear, después hay que conectarlo a Mercado Libre.',
      inputSchema: {
        nombre: z.string().min(1).max(255),
        idMercadoLibre: z.string().regex(/^\d+$/).optional(),
        listaId: uuid('lista de precios').optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ nombre, idMercadoLibre, listaId }) =>
      resultado(
        await llamar(sellers, { method: 'POST', body: { nombre, idmercadolibre: idMercadoLibre, listaId } }),
      ),
  );

  servidor.registerTool(
    'reasignar_paquete',
    {
      title: 'Reasignar paquete',
      description: 'Pasa un paquete a otro transportista, o lo deja sin asignar (transportistaId null).',
      inputSchema: {
        paqueteId: uuid('paquete'),
        transportistaId: uuid('transportista').nullable(),
      },
      annotations: ESCRITURA,
    },
    async ({ paqueteId, transportistaId }) =>
      resultado(
        await llamar(reasignar, { method: 'POST', body: { id: paqueteId, idtransportista: transportistaId } }),
      ),
  );

  servidor.registerTool(
    'crear_lista',
    {
      title: 'Crear lista',
      description: 'Crea una lista de precios o de costos, con todas las zonas en $0.',
      inputSchema: { tipo: tipoLista, nombre: z.string().min(1).max(100) },
      annotations: ESCRITURA,
    },
    async ({ tipo, nombre }) => resultado(await operarLista(tipo, { op: 'crearLista', nombre })),
  );

  servidor.registerTool(
    'renombrar_lista',
    {
      title: 'Renombrar lista',
      inputSchema: { tipo: tipoLista, listaId: uuid('lista'), nombre: z.string().min(1).max(100) },
      annotations: ESCRITURA,
    },
    async ({ tipo, listaId, nombre }) =>
      resultado(await operarLista(tipo, { op: 'renombrarLista', listaId, nombre })),
  );

  servidor.registerTool(
    'cambiar_tarifa',
    {
      title: 'Cambiar tarifa de una zona',
      description: 'Fija el importe en pesos de una zona dentro de una lista.',
      inputSchema: {
        tipo: tipoLista,
        listaId: uuid('lista'),
        zonaId: uuid('zona'),
        importe: z.number().min(0).max(100_000_000),
      },
      annotations: ESCRITURA,
    },
    async ({ tipo, listaId, zonaId, importe }) =>
      resultado(await operarLista(tipo, { op: 'setTarifa', listaId, zonaId, importe })),
  );

  servidor.registerTool(
    'ajustar_tarifas',
    {
      title: 'Ajustar varias tarifas',
      description:
        'Aplica un aumento o descuento porcentual (porcentaje negativo = descuento), o fija un mismo ' +
        'importe, en varias zonas de una lista. Sin zonaIds se aplica a todas las zonas. Mandá porcentaje o importe, no los dos.',
      inputSchema: {
        tipo: tipoLista,
        listaId: uuid('lista'),
        porcentaje: z.number().min(-100).max(500).optional(),
        importe: z.number().min(0).max(100_000_000).optional(),
        zonaIds: z.array(uuid('zona')).min(1).optional(),
      },
      annotations: ESCRITURA,
    },
    async ({ tipo, listaId, porcentaje, importe, zonaIds }) => {
      if ((porcentaje == null) === (importe == null)) {
        throw new Error('Indicá porcentaje o importe (uno de los dos)');
      }
      return resultado(await operarLista(tipo, { op: 'setTarifasBulk', listaId, porcentaje, importe, zonaIds }));
    },
  );

  servidor.registerTool(
    'asignar_lista',
    {
      title: 'Asignar lista',
      description:
        'Asigna una lista de precios a un seller (tipo precio) o de costos a un transportista (tipo costo). ' +
        'listaId null le saca la lista.',
      inputSchema: {
        tipo: tipoLista,
        entidadId: uuid('seller o transportista'),
        listaId: uuid('lista').nullable(),
      },
      annotations: ESCRITURA,
    },
    async ({ tipo, entidadId, listaId }) =>
      resultado(await operarLista(tipo, { op: 'asignarEntidad', entidadId, listaId })),
  );

  servidor.registerTool(
    'asignar_barrio_zona',
    {
      title: 'Asignar barrio a zona',
      description: 'Cambia la zona por defecto de un barrio para toda la empresa. zonaId null lo deja sin zona.',
      inputSchema: { barrioId: uuid('barrio'), zonaId: uuid('zona').nullable() },
      annotations: ESCRITURA,
    },
    async ({ barrioId, zonaId }) =>
      resultado(await llamar(precios, { method: 'POST', body: { op: 'asignarArea', areaId: barrioId, zonaId } })),
  );

  servidor.registerTool(
    'crear_zona',
    {
      title: 'Crear zona',
      description: 'Crea una zona nueva; se agrega en $0 a todas las listas de precios y costos.',
      inputSchema: { nombre: z.string().min(1).max(100) },
      annotations: ESCRITURA,
    },
    async ({ nombre }) =>
      resultado(await llamar(precios, { method: 'POST', body: { op: 'crearZona', nombre } })),
  );

  return servidor;
}
