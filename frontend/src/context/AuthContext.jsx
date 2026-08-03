import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch, intentarRefresh, setAuthSyncHandlers } from '../services/api.js';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'packen_token';
const STORAGE_KEY_USER = 'packen_usuario';

// El backend ya no manda id ni email, pero una sesión guardada antes de ese
// cambio sí los tiene: normalizamos siempre antes de persistir o usar.
function perfilSeguro(usuario) {
  if (!usuario) return null;
  return {
    nombre: usuario.nombre,
    rol: usuario.rol,
    estado_solicitud: usuario.estado_solicitud ?? null,
  };
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? perfilSeguro(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN));

  // Si no hay access token en localStorage puede que igual haya una sesión
  // viva: el refresh token vive en una cookie httpOnly que JS no puede leer.
  // Arrancamos "cargando" e intentamos rehidratar antes de mandar a /login.
  const [cargandoSesion, setCargandoSesion] = useState(
    () => !localStorage.getItem(STORAGE_KEY_TOKEN),
  );

  const guardarSesion = useCallback((nuevoToken, nuevoUsuario) => {
    const perfil = perfilSeguro(nuevoUsuario);
    localStorage.setItem(STORAGE_KEY_TOKEN, nuevoToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(perfil));
    setToken(nuevoToken);
    setUsuario(perfil);
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // el logout local debe funcionar aunque falle la llamada al servidor
    } finally {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
      setToken(null);
      setUsuario(null);
    }
  }, []);

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
      onSessionExpired: () => {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);
        setToken(null);
        setUsuario(null);
      },
    });
  }, [guardarSesion]);

  // Rehidratación al arrancar: sin access token, probamos canjear la cookie
  // httpOnly por uno nuevo. Si no hay cookie (o venció) el refresh falla y
  // seguimos deslogueados, que es el estado con el que ya arrancamos.
  useEffect(() => {
    if (!cargandoSesion) return undefined;

    let cancelado = false;
    intentarRefresh()
      .then((res) => {
        if (!cancelado) guardarSesion(res.token, res.usuario);
      })
      .catch(() => {
        if (!cancelado) {
          localStorage.removeItem(STORAGE_KEY_TOKEN);
          localStorage.removeItem(STORAGE_KEY_USER);
        }
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
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
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
