import { ErrorPublico } from './errores.js';

// Rate limiting de login y registro, guardado en la tabla intento_auth (ver
// migration-aut-v3.sql). No hay memoria compartida entre invocaciones de una
// Serverless Function, así que el contador tiene que vivir en la base.
//
// Cada regla es { clave, max, ventanaMin }: si en los últimos `ventanaMin`
// minutos hay `max` o más intentos con esa clave, se corta con 429.

export const LIMITES = {
  // Por cuenta: 5 contraseñas mal en 15 minutos bloquean esa cuenta 15 minutos.
  loginPorCuenta: { max: 5, ventanaMin: 15 },
  // Por IP: más alto, para no bloquear una oficina entera que comparte IP.
  loginPorIp: { max: 20, ventanaMin: 15 },
  registroPorIp: { max: 5, ventanaMin: 60 },
};

// En Vercel x-forwarded-for lo pisa la plataforma con la IP real del cliente,
// así que no lo puede falsear quien hace la request.
export function ipDe(req) {
  const h = req.headers ?? {};
  const bruto = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || '';
  return String(bruto).split(',')[0].trim() || 'desconocida';
}

const desde = (ventanaMin) => new Date(Date.now() - ventanaMin * 60 * 1000).toISOString();

// Lanza ErrorPublico 429 si alguna de las reglas está excedida.
export async function verificarLimites(supabase, reglas) {
  for (const { clave, max, ventanaMin } of reglas) {
    const { count, error } = await supabase
      .from('intento_auth')
      .select('id', { count: 'exact', head: true })
      .eq('clave', clave)
      .gte('created_at', desde(ventanaMin));

    if (error) {
      // Sin la tabla (migración no aplicada) no podemos contar. Se deja pasar
      // para no tumbar el login de todos, pero bien visible en el log.
      console.error('[PacKen RateLimit] No se pudo leer intento_auth:', error.message);
      return;
    }

    if ((count ?? 0) >= max) {
      const err = new ErrorPublico(
        `Demasiados intentos. Esperá ${ventanaMin} minutos y volvé a probar.`,
        429,
      );
      err.reintentarEnSeg = ventanaMin * 60;
      throw err;
    }
  }
}

export async function registrarIntento(supabase, claves) {
  const { error } = await supabase
    .from('intento_auth')
    .insert(claves.map((clave) => ({ clave })));
  if (error) console.error('[PacKen RateLimit] No se pudo registrar el intento:', error.message);

  // Limpieza oportunista: 1 de cada 50 llamadas borra lo de más de un día.
  if (Math.random() < 0.02) {
    await supabase.from('intento_auth').delete().lt('created_at', desde(24 * 60));
  }
}

export async function limpiarIntentos(supabase, clave) {
  const { error } = await supabase.from('intento_auth').delete().eq('clave', clave);
  if (error) console.error('[PacKen RateLimit] No se pudieron limpiar intentos:', error.message);
}
