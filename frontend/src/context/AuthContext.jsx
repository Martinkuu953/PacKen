import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [rol, setRol] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = useCallback(async (authUser) => {
    if (!authUser) {
      setPerfil(null);
      setRol(null);
      return;
    }

    const { data: empresa } = await supabase
      .from('empresa')
      .select('id, nombre, email')
      .eq('id', authUser.id)
      .maybeSingle();

    if (empresa) {
      setPerfil(empresa);
      setRol('empresa');
      return;
    }

    const { data: transportista } = await supabase
      .from('transportista')
      .select('id, nombre, email, telefono, id_empresa')
      .eq('id', authUser.id)
      .maybeSingle();

    if (transportista) {
      setPerfil(transportista);
      setRol('transportista');
      return;
    }

    setPerfil(null);
    setRol(null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      cargarPerfil(authUser).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user ?? null;
        setUser(authUser);
        await cargarPerfil(authUser);
      }
    );

    return () => subscription.unsubscribe();
  }, [cargarPerfil]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
    setRol(null);
  };

  return (
    <AuthContext.Provider value={{ user, perfil, rol, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
