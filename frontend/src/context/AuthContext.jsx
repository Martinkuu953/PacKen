import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch, intentarRefresh, setAccessToken, setAuthSyncHandlers } from '../services/api.js';

const AuthContext = createContext(null);

// El backend ya no manda id ni email; normalizamos igual por si algún día
// vuelve a colarse un campo de más.
function perfilSeguro(usuario) {
  if (!usuario) return null;
  return {
    nombre: usuario.nombre,
    rol: usuario.rol,
    estado_solicitud: usuario.estado_solicitud ?? null,
  };
}

// A-03: ni el access token ni el perfil se guardan en el navegador. Viven en
// el estado de React (y el token, además, en la variable de services/api.js,
// que es la que usa cada request). Al recargar la página se pierden y la
// sesión se rehidrata con el refresh token de la cookie httpOnly, que JS no
// puede leer.
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);

  // Siempre arrancamos "cargando": sin nada guardado, la única forma de saber
  // si hay sesión es probar el refresh contra la cookie.
  const [cargandoSesion, setCargandoSesion] = useState(true);

  const guardarSesion = useCallback((nuevoToken, nuevoUsuario) => {
    setAccessToken(nuevoToken);
    setToken(nuevoToken);
    setUsuario(perfilSeguro(nuevoUsuario));
  }, []);

  const limpiarSesion = useCallback(() => {
    setAccessToken(null);
    setToken(null);
    setUsuario(null);
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // el logout local debe funcionar aunque falle la llamada al servidor
    } finally {
      limpiarSesion();
    }
  }, [limpiarSesion]);

  const registrar = useCallback(async (datos) => {
    const res = await apiFetch('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify(datos),
    });
    guardarSesion(res.token, res.usuario);
    return res.usuario;
  }, [guardarSesion]);

  const login = useCallback(async (identificador, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identificador, password }),
    });
    guardarSesion(res.token, res.usuario);
    return res.usuario;
  }, [guardarSesion]);

  useEffect(() => {
    setAuthSyncHandlers({
      onTokenRefreshed: guardarSesion,
      onSessionExpired: limpiarSesion,
    });
  }, [guardarSesion, limpiarSesion]);

  // Rehidratación al arrancar: canjeamos la cookie httpOnly por un access
  // token nuevo. Si no hay cookie (o venció) el refresh falla y seguimos
  // deslogueados.
  useEffect(() => {
    let cancelado = false;
    intentarRefresh()
      .then((res) => {
        if (!cancelado) guardarSesion(res.token, res.usuario);
      })
      .catch(() => {
        if (!cancelado) limpiarSesion();
      })
      .finally(() => {
        if (!cancelado) setCargandoSesion(false);
      });

    return () => {
      cancelado = true;
    };
    // Solo al montar: es la rehidratación inicial, no debe repetirse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refrescarUsuario = useCallback(async () => {
    const res = await apiFetch('/api/auth/me');
    const updated = perfilSeguro(res.usuario);
    setUsuario(updated);
    return updated;
  }, []);

  const autenticado = Boolean(token && usuario);
  const esEmpresa = usuario?.rol === 'empresa';
  const esTransportista = usuario?.rol === 'transportista';
  const aprobado = !esTransportista || usuario?.estado_solicitud === 'aceptado';

  return (
    <AuthContext.Provider value={{
      usuario, token, autenticado, aprobado, cargandoSesion,
      esEmpresa, esTransportista,
      registrar, login, cerrarSesion, refrescarUsuario,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
