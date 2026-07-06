import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch, setAuthSyncHandlers } from '../services/api.js';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'packen_token';
const STORAGE_KEY_USER = 'packen_usuario';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY_TOKEN));

  const guardarSesion = useCallback((nuevoToken, nuevoUsuario) => {
    localStorage.setItem(STORAGE_KEY_TOKEN, nuevoToken);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(nuevoUsuario));
    setToken(nuevoToken);
    setUsuario(nuevoUsuario);
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

  const refrescarUsuario = useCallback(async () => {
    const res = await apiFetch('/api/auth/me');
    const updated = res.usuario;
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
      usuario, token, autenticado, aprobado,
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
