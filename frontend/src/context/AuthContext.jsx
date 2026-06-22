import { createContext, useContext, useEffect, useState } from 'react';
import { getToken } from '../services/api';
import {
  login as loginRequest,
  registrarSeller as registrarSellerRequest,
  logout as logoutRequest,
  obtenerUsuarioActual,
} from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, si hay token guardado, rehidratamos el usuario.
  useEffect(() => {
    let activo = true;
    async function rehidratar() {
      if (!getToken()) {
        setCargando(false);
        return;
      }
      try {
        const u = await obtenerUsuarioActual();
        if (activo) setUsuario(u);
      } catch {
        logoutRequest();
      } finally {
        if (activo) setCargando(false);
      }
    }
    rehidratar();
    return () => {
      activo = false;
    };
  }, []);

  async function login(identificador, contrasena) {
    const u = await loginRequest(identificador, contrasena);
    setUsuario(u);
    return u;
  }

  async function registrarSeller(datos) {
    const u = await registrarSellerRequest(datos);
    setUsuario(u);
    return u;
  }

  function logout() {
    logoutRequest();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, registrarSeller, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
