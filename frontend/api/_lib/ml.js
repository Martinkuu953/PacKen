// Módulo compartido para las funciones serverless de /api.
// Centraliza: cliente Supabase, manejo de tokens de MercadoLibre
// (refresh + persistencia + reintento en 401), resolución de seller,
// y el mapeo del shipment de ML a los datos del paquete.
//
// NOTA: los archivos/carpetas que empiezan con "_" dentro de /api NO se
// exponen como endpoints en Vercel, pero sí se pueden importar.

import { createClient } from '@supabase/supabase-js';
import { ESTADOS } from '../../shared/estados.js';
import { ErrorPublico } from './errores.js';

const ML_API = 'https://api.mercadolibre.com';

// Estado operativo del courier según la acción de escaneo.
export const ESTADO_POR_TIPO = {
  colecta: ESTADOS.INGRESADO,
  reparto: ESTADOS.EN_CAMINO,
};

// ──────────────────────────────────────────────────────────────────────────
// Supabase (service role → bypasea RLS, necesario para leer/escribir meli_token)
// ──────────────────────────────────────────────────────────────────────────
// Sin fallbacks con prefijo VITE_ a propósito: Vite empaqueta en el bundle
// público toda variable que empiece con VITE_, así que aceptarlas acá invita a
// que un secreto de servidor termine servido al navegador. Además el fallback
// a la publishable key era peor que un error: la API habría arrancado con la
// key anónima y fallado recién al chocar contra RLS, en runtime y sin decir
// por qué.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no configurados en Vercel');
  }
  return createClient(url, key);
}

// ──────────────────────────────────────────────────────────────────────────
// Traducción del estado de ML al estado interno del courier
// ──────────────────────────────────────────────────────────────────────────
export function traducirEstadoML(status) {
  switch (status) {
    case 'delivered':
      return ESTADOS.ENTREGADO;
    case 'cancelled':
      return ESTADOS.CANCELADO;
    case 'not_delivered':
      return ESTADOS.REPROGRAMADO;
    case 'shipped':
      return ESTADOS.EN_CAMINO;
    case 'pending':
    case 'handling':
    case 'ready_to_ship':
      return ESTADOS.INGRESADO;
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tokens de MercadoLibre
// ──────────────────────────────────────────────────────────────────────────
async function refreshMLToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error renovando token ML: ${err.message || res.status}`);
  }

  return res.json();
}

async function guardarTokens(supabase, tokenId, data, refreshTokenPrevio) {
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString();
  await supabase
    .from('meli_token')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshTokenPrevio,
      expires_at: expiresAt,
      fechaactualizacion: new Date().toISOString(),
    })
    .eq('id', tokenId);
  console.log(`[PacKen] Token renovado y guardado (meli_token id=${tokenId}), expira ${expiresAt}`);
}

// Devuelve un access token válido, renovándolo y persistiéndolo si está vencido.
export async function getValidToken(supabase, idSellerInterno) {
  const { data: tokenRow, error } = await supabase
    .from('meli_token')
    .select('id, access_token, refresh_token, expires_at')
    .eq('idseller', idSellerInterno)
    .limit(1)
    .single();

  if (error || !tokenRow) {
    throw new Error(`No hay tokens en meli_token para seller id=${idSellerInterno}`);
  }

  const vencido = !tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() <= Date.now();

  if (!vencido) {
    return { accessToken: tokenRow.access_token, tokenId: tokenRow.id, refreshToken: tokenRow.refresh_token };
  }

  console.log(`[PacKen] Token vencido para seller id=${idSellerInterno}, renovando...`);
  const data = await refreshMLToken(tokenRow.refresh_token);
  await guardarTokens(supabase, tokenRow.id, data, tokenRow.refresh_token);

  return {
    accessToken: data.access_token,
    tokenId: tokenRow.id,
    refreshToken: data.refresh_token || tokenRow.refresh_token,
  };
}

async function callMLAPI(path, accessToken) {
  // OJO: NO usar 'x-format-new': 'true'. Con ese header la respuesta cambia
  // (receiver_address desaparece y los datos quedan en destination.shipping_address,
  // y no viene sender_id). El formato por defecto trae todo plano en receiver_address.
  const res = await fetch(`${ML_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) throw new Error('401_UNAUTHORIZED');

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Error ${res.status} en ${path}`);
  }

  return res.json();
}

// Llama a la API de ML con reintento automático: si da 401, fuerza un refresh
// del token, lo persiste, y reintenta una vez.
export async function mlFetchConReintento(supabase, idSellerInterno, path) {
  let { accessToken, tokenId, refreshToken } = await getValidToken(supabase, idSellerInterno);

  try {
    return await callMLAPI(path, accessToken);
  } catch (err) {
    if (err.message !== '401_UNAUTHORIZED') throw err;

    console.log(`[PacKen] 401 en ${path}, forzando refresh de token...`);
    const data = await refreshMLToken(refreshToken);
    await guardarTokens(supabase, tokenId, data, refreshToken);
    return callMLAPI(path, data.access_token);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Resolución del seller interno a partir del sender_id de ML
// ──────────────────────────────────────────────────────────────────────────
// El sellerId de MercadoLibre no es secreto: viaja en el QR del paquete y en
// las URLs de ML. Por eso la búsqueda SIEMPRE se acota a la empresa que hace
// el pedido; si no, cualquier usuario autenticado podría leer o escribir
// paquetes de otra empresa pasando un sender_id ajeno.
//
// idEmpresa es obligatorio a propósito: que sea un parámetro que hay que
// pasar sí o sí evita que un caller nuevo se olvide de acotar.
export async function resolverSellerInterno(supabase, sellerIdMl, idEmpresa) {
  if (idEmpresa == null) {
    throw new Error('resolverSellerInterno requiere idEmpresa');
  }

  const { data: seller } = await supabase
    .from('seller')
    .select('id')
    .eq('idmercadolibre', String(sellerIdMl))
    .eq('idempresa', idEmpresa)
    .limit(1)
    .maybeSingle();

  // Mensaje deliberadamente vago: distinguir "no existe" de "no es tuyo" deja
  // enumerar qué sellers hay en el sistema iterando ids.
  if (!seller) {
    throw new ErrorPublico('Seller no encontrado', 404);
  }
  return seller.id;
}

// ──────────────────────────────────────────────────────────────────────────
// Conexión inicial de un seller (OAuth "authorization_code")
// ──────────────────────────────────────────────────────────────────────────

// Canjea el "code" que ML manda por redirect_uri por el primer access_token
// + refresh_token del seller. A diferencia de refreshMLToken (grant
// "refresh_token", usado en cada renovación), este solo se usa una vez, al
// conectar la cuenta.
export async function pedirTokenPorCodigo(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ML_CLIENT_ID,
    client_secret: process.env.ML_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Error canjeando code por token: ${data.message || res.status}`);
  }
  return data;
}

export async function obtenerUsuarioML(accessToken) {
  return callMLAPI('/users/me', accessToken);
}

// Crea el seller (o actualiza su nombre/empresa si ya existía por otro
// medio, ej. registrar-seller.mjs) y guarda su primer token.
export async function guardarSellerYToken(
  supabase,
  { idempresa, idMercadoLibre, nombre, accessToken, refreshToken, expiresIn },
) {
  const { data: sellerExistente, error: selErr } = await supabase
    .from('seller')
    .select('id')
    .eq('idmercadolibre', String(idMercadoLibre))
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  let idSellerInterno;
  if (sellerExistente) {
    idSellerInterno = sellerExistente.id;
    const { error } = await supabase
      .from('seller')
      .update({ nombre, idempresa })
      .eq('id', idSellerInterno);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('seller')
      .insert({ idempresa, nombre, idmercadolibre: String(idMercadoLibre) })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    idSellerInterno = data.id;
  }

  const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
  const { data: tokenExistente, error: tokErr } = await supabase
    .from('meli_token')
    .select('id')
    .eq('idseller', idSellerInterno)
    .maybeSingle();
  if (tokErr) throw new Error(tokErr.message);

  if (tokenExistente) {
    const { error } = await supabase
      .from('meli_token')
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        fechaactualizacion: new Date().toISOString(),
      })
      .eq('id', tokenExistente.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('meli_token')
      .insert({ access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, idseller: idSellerInterno });
    if (error) throw new Error(error.message);
  }

  return { idSellerInterno, yaExistia: Boolean(sellerExistente) };
}

// ──────────────────────────────────────────────────────────────────────────
// Mapeo del shipment de ML → datos del paquete
// ──────────────────────────────────────────────────────────────────────────
function limpiarTelefono(tel) {
  if (!tel) return null;
  // ML enmascara el teléfono (ej. "XXXXXXX"); no tiene sentido mostrarlo.
  if (/^[X\s().+-]+$/i.test(tel)) return null;
  return tel;
}

// Normaliza un texto a una clave estable de matcheo (sin acentos, minúsculas):
// se usa como ml_ref de un barrio cuando ML no da un id numérico.
export function normalizarRef(texto) {
  if (!texto) return null;
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), ''); // saca acentos combinantes
}

export function mapShipment(shipment) {
  // Soporta ambos formatos de respuesta de ML:
  //  - legacy (default): datos planos en receiver_address + sender_id
  //  - nuevo (x-format-new): destination { receiver_name, receiver_phone, shipping_address }
  const dest = shipment.destination || {};
  const dir = shipment.receiver_address || dest.shipping_address || {};
  const hist = shipment.status_history || {};

  // "Parte" de Flex: el barrio (CABA) o municipio (GBA/interior) del destino.
  // Preferimos neighborhood > municipality > city. barrioRef es la clave de
  // matcheo con area_flex: el id de ML si viene, si no el nombre normalizado.
  const barrioObj = dir.neighborhood || dest.neighborhood || dir.municipality || dest.municipality || null;
  const barrio = barrioObj?.name || dir.city?.name || dest.city?.name || null;
  const barrioRef = barrioObj?.id != null ? String(barrioObj.id) : normalizarRef(barrio);

  return {
    idEnvioMl: String(shipment.id),
    sellerId: shipment.sender_id != null ? String(shipment.sender_id) : null,

    // Datos del destinatario
    comprador: dir.receiver_name || dest.receiver_name || null,
    direccion: dir.address_line || null,
    codigoPostal: dir.zip_code || null,
    ciudad: dir.city?.name || null,
    provincia: dir.state?.name || null,
    barrio,
    barrioRef,
    telefono: limpiarTelefono(dir.receiver_phone || dest.receiver_phone),
    comentario: dir.comment || dest.comments || null,

    // Estado real de ML + estado interno traducido
    estadoMl: shipment.status || null,
    subestadoMl: shipment.substatus || null,
    estado: traducirEstadoML(shipment.status),

    // Logística / tracking
    trackingNumber: shipment.tracking_number || null,
    trackingMethod: shipment.tracking_method || null,
    tipoLogistica: shipment.logistic_type || shipment.logistic?.type || null,
    modo: shipment.mode || null,

    // Fechas
    fechaCreacion: shipment.date_created || null,
    fechaEnviado: hist.date_shipped || null,
    fechaEntrega: hist.date_delivered || null,
    ultimaActualizacion: shipment.last_updated || null,
  };
}

// Trae un shipment de ML ya mapeado.
export async function obtenerShipment(supabase, idSellerInterno, shipmentId) {
  const shipment = await mlFetchConReintento(supabase, idSellerInterno, `/shipments/${shipmentId}`);
  return mapShipment(shipment);
}

// ──────────────────────────────────────────────────────────────────────────
// Mercado Envíos Flex — áreas de cobertura (barrios/municipios)
// ──────────────────────────────────────────────────────────────────────────
// Best-effort: el esquema exacto de estos endpoints está en la doc de ML
// (protegida por WAF), así que parseamos de forma tolerante. Flujo:
//   1) service_id de Flex desde las shipping_preferences del seller
//   2) zonas de cobertura con show_availables=true
//   3) aplanar todo a una lista de { ref, nombre } deduplicada
// Si algo falla, tira un error claro y el caller cae en el auto-descubrimiento
// por escaneo (que puebla area_flex igual).

const SITE_ID = 'MLA';

function extraerFlexServiceId(prefs) {
  const servicios = prefs?.services || prefs?.logistics || [];
  for (const s of servicios) {
    const tipo = String(s?.type || s?.mode || s?.logistic_type || s?.name || '').toLowerCase();
    if (tipo.includes('self_service') || tipo.includes('flex')) {
      return s.id ?? s.service_id ?? s.shipping_service_id ?? null;
    }
  }
  // Fallback: si hay un único service, usarlo.
  if (servicios.length === 1) return servicios[0].id ?? servicios[0].service_id ?? null;
  return null;
}

function aplanarAreasFlex(data) {
  // Junta "zones" (configuradas) y "availables" (agregables, con
  // show_availables=true). Cada elemento puede traer sub-áreas
  // (barrios/municipios); aplanamos un nivel y deduplicamos por ref.
  const salida = new Map();
  const empujar = (item) => {
    if (!item) return;
    const nombre = item.name || item.nombre || item.description || null;
    const ref = item.id ?? item.zip_code ?? nombre;
    if (!nombre || ref == null) return;
    salida.set(String(ref), { ref: String(ref), nombre: String(nombre) });
  };
  const recorrer = (coleccion) => {
    for (const z of coleccion || []) {
      const hijos = z.areas || z.neighborhoods || z.municipalities || z.localities || z.children;
      if (Array.isArray(hijos) && hijos.length) hijos.forEach(empujar);
      else empujar(z);
    }
  };
  recorrer(data?.zones);
  recorrer(Array.isArray(data?.availables) ? data.availables : data?.availables?.zones);
  return [...salida.values()];
}

// Devuelve las áreas de cobertura Flex del seller como [{ ref, nombre }].
export async function obtenerAreasFlex(supabase, idSellerInterno, sellerMlId) {
  const prefs = await mlFetchConReintento(
    supabase,
    idSellerInterno,
    `/users/${sellerMlId}/shipping_preferences`,
  );
  const serviceId = extraerFlexServiceId(prefs);
  if (!serviceId) {
    throw new ErrorPublico('No se encontró un servicio de Flex en la cuenta de ML del seller.');
  }

  const path = `/flex/sites/${SITE_ID}/users/${sellerMlId}/services/${serviceId}/configurations/coverage/zones/v1?show_availables=true`;
  const data = await mlFetchConReintento(supabase, idSellerInterno, path);

  const areas = aplanarAreasFlex(data);
  if (!areas.length) {
    throw new ErrorPublico('Flex no devolvió barrios/áreas de cobertura para sincronizar.');
  }
  return areas;
}
