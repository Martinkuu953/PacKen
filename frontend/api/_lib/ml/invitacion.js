import jwt from 'jsonwebtoken';
import { getSupabase } from '../ml.js';
import { autenticar, requiereRol } from '../auth.js';
import { responderError } from '../errores.js';
import { baseUrl, buscarSellerDeEmpresa, iniciarAutorizacion } from './conectar.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Link de invitación para que un seller conecte su cuenta de ML desde su
// propio celular, sin tener que sentarse en la compu de la empresa.
//
// El problema que resuelve: /api/ml/conectar ata el OAuth al navegador que
// apretó el botón (cookie de nonce), así que un link de ML mandado por WhatsApp
// fallaba en el callback. La cookie no se puede sacar —es lo que impide que
// una empresa se quede con los tokens de un seller que no sabe a quién está
// autorizando—, así que en vez de mandar el link de ML se manda uno de PacKen
// que arranca el flujo recién en el navegador del seller. Ahí se crea la
// cookie, y el callback valida exactamente igual que siempre.
//
// El link es de UN seller, que la empresa ya creó en "Nuevo seller" con su
// nombre y su lista: al aceptar, la cuenta de ML se suma a esa fila. Por eso
// no hace falta una tabla de invitaciones para que no se reuse: después de la
// primera conexión el seller queda atado a esa cuenta (ver conectarSeller), y
// el link ya solo sirve para que esa misma cuenta se reconecte.
//
// Antes de ir a ML el seller ve qué empresa lo invita (la página
// /conectar-ml): autoriza sabiendo a quién le da acceso.

// Audience propio, igual que el state del OAuth: un token de invitación no
// sirve como sesión ni como state, ni al revés.
export const AUDIENCE_INVITACION = 'packen:ml-invitacion';

const VIGENCIA_HORAS = 72;

// Lo que importa al cliente es `motivo` (la página /conectar-ml tiene los
// textos para el seller); el `error` es solo para quien mire la respuesta cruda.
const MOTIVOS = {
  vencida: 'Invitación vencida',
  invalida: 'Invitación inválida',
};

// Devuelve { seller, empresa, conectado, vence } si la invitación es válida, o
// { motivo } si no.
//
// En el token viaja el public_id del seller, nunca un id interno: el payload de
// un JWT se lee con atob(), y este link termina en el WhatsApp de un tercero.
// Seller y empresa se vuelven a buscar en la base: un seller borrado, o una
// empresa dada de baja, invalidan los links que ya se mandaron.
async function leerInvitacion(supabase, token) {
  if (typeof token !== 'string' || !token) return { motivo: 'invalida' };

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { audience: AUDIENCE_INVITACION, algorithms: ['HS256'] });
  } catch (err) {
    return { motivo: err.name === 'TokenExpiredError' ? 'vencida' : 'invalida' };
  }
  if (!payload.sel) return { motivo: 'invalida' };

  const { data: seller, error: errSeller } = await supabase
    .from('seller')
    .select('id, nombre, idempresa')
    .eq('public_id', String(payload.sel))
    .maybeSingle();
  if (errSeller) throw new Error(errSeller.message);
  if (!seller) return { motivo: 'invalida' };

  const { data: empresa, error: errEmpresa } = await supabase
    .from('usuario')
    .select('id, nombre')
    .eq('id', seller.idempresa)
    .eq('rol', 'empresa')
    .maybeSingle();
  if (errEmpresa) throw new Error(errEmpresa.message);
  if (!empresa) return { motivo: 'invalida' };

  const { data: conexion, error: errToken } = await supabase
    .from('meli_token')
    .select('id')
    .eq('idseller', seller.id)
    .maybeSingle();
  if (errToken) throw new Error(errToken.message);

  return {
    seller,
    empresa,
    conectado: Boolean(conexion),
    vence: new Date(payload.exp * 1000).toISOString(),
  };
}

// POST /api/ml/invitacion { sellerId } — la empresa pide el link de uno de sus
// sellers. Requiere sesión.
async function crear(req, res) {
  const usuario = await autenticar(req, res);
  if (!usuario) return;
  if (!requiereRol(res, usuario, 'empresa')) return;

  const seller = await buscarSellerDeEmpresa(getSupabase(), req.body?.sellerId, usuario.id);

  const token = jwt.sign({ sel: seller.public_id }, JWT_SECRET, {
    expiresIn: `${VIGENCIA_HORAS}h`,
    audience: AUDIENCE_INVITACION,
    algorithm: 'HS256',
  });

  return res.status(201).json({
    url: `${baseUrl(req)}/conectar-ml?inv=${encodeURIComponent(token)}`,
    vence: new Date(Date.now() + VIGENCIA_HORAS * 60 * 60 * 1000).toISOString(),
  });
}

// GET /api/ml/invitacion?inv=... — pública: la abre el seller, que no tiene
// cuenta en PacKen. Dos modos:
//
//   ?inv=X             → JSON con empresa y seller, para que la página
//                        /conectar-ml le muestre quién lo invita.
//   ?inv=X&autorizar=1 → arranca el OAuth en este navegador (cookie de nonce
//                        incluida) y redirige a ML. Es una navegación, no un
//                        fetch: por eso los errores vuelven como redirect a la
//                        página y no como JSON.
async function abrir(req, res) {
  const { inv, autorizar } = req.query ?? {};
  const { seller, empresa, conectado, vence, motivo } = await leerInvitacion(getSupabase(), inv);

  if (autorizar) {
    if (motivo) return res.redirect(302, `/conectar-ml?estado=${motivo}`);
    const url = iniciarAutorizacion(req, res, {
      idempresa: empresa.id,
      idseller: seller.id,
      via: 'invitacion',
    });
    console.log(`[PacKen] Invitación ML abierta: seller ${seller.id} (empresa ${empresa.id}) → redirigiendo a ML`);
    return res.redirect(302, url);
  }

  if (motivo) {
    return res.status(motivo === 'vencida' ? 410 : 400).json({ error: MOTIVOS[motivo], motivo });
  }
  return res.json({ empresa: empresa.nombre, seller: seller.nombre, conectado, vence });
}

export default async function invitacion(req, res) {
  try {
    if (req.method === 'POST') return await crear(req, res);
    if (req.method === 'GET') return await abrir(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    // En modo autorizar el seller está navegando: un JSON de error lo dejaría
    // mirando texto crudo. Se lo manda a la página con un error genérico.
    if (req.method === 'GET' && req.query?.autorizar) {
      console.error('[PacKen] Error abriendo invitación ML:', err);
      return res.redirect(302, '/conectar-ml?estado=error');
    }
    return responderError(res, err, 500, 'ml/invitacion');
  }
}
