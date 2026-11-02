// Llama a un handler de /api desde adentro del servidor, como si fuera una
// request del usuario logueado.
//
// Las herramientas del asistente (ver mcp.js) no reimplementan nada: reusan
// los mismos handlers que usa la UI, con el token del usuario. Así heredan
// toda la validación y, sobre todo, el filtro por empresa de autenticar(): el
// asistente no puede ver ni tocar nada que el usuario no pueda desde la pantalla.

export class ErrorHerramienta extends Error {}

export async function invocar(handler, { token, method = 'GET', query = {}, body } = {}) {
  const req = {
    method,
    query,
    body,
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  };

  let status = 200;
  let payload;
  const res = {
    status(codigo) {
      status = codigo;
      return res;
    },
    json(datos) {
      payload = datos;
      return res;
    },
    setHeader() {
      return res;
    },
    end() {
      return res;
    },
  };

  await handler(req, res);

  // El mensaje de error ya viene filtrado por responderError(): los internos
  // llegan genéricos, los de negocio ("Lista no encontrada") tal cual.
  if (status >= 400) throw new ErrorHerramienta(payload?.error ?? `Error ${status}`);
  return payload;
}
