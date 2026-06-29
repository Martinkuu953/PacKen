import { createContext, useContext, useState, useCallback } from 'react';
import { apiFetch } from '../services/api.js';

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

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    setToken(null);
    setUsuario(null);
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

  const autenticado = Boolean(token && usuario);
  const esEmpresa = usuario?.rol === 'empresa';
  const esTransportista = usuario?.rol === 'transportista';

  return (
    <AuthContext.Provider value={{
      usuario, token, autenticado,
      esEmpresa, esTransportista,
      registrar, login, cerrarSesion,
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
