// Separa los errores que el usuario puede ver de los que no.
//
// El problema que resuelve: casi todos los handlers hacían
// `res.json({ error: err.message })`, y buena parte de esos mensajes vienen
// crudos de Postgres/Supabase ("column paquete.idzona does not exist",
// 'relation "meli_token" ...'). Eso le regala a un atacante el esquema de la
// base. Pero devolver todo genérico rompería la UI, que muestra mensajes
// útiles como "Solo se puede entregar un paquete en camino".
//
// Regla: lo que se lanza como ErrorPublico se muestra; cualquier otra cosa se
// loguea completa en el servidor y al cliente le llega un mensaje genérico.

export class ErrorPublico extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorPublico';
    this.status = status;
  }
}

// Único punto de salida de errores de los handlers. `statusPorDefecto` es el
// que se usa cuando el error no trae uno propio.
export function responderError(res, err, statusPorDefecto = 500, contexto = 'API') {
  // Siempre el error completo del lado servidor: en Vercel queda en los logs
  // de la función, que es donde se diagnostica.
  console.error(`[PacKen] Error en ${contexto}:`, err);

  if (err instanceof ErrorPublico) {
    return res.status(err.status).json({ error: err.message });
  }

  return res.status(statusPorDefecto).json({
    error: 'Error interno del servidor. Volvé a intentar en un momento.',
  });
}
