import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Paquetes from './pages/Paquetes';
import Transportistas from './pages/Transportistas';

function RutaPrivada({ children, rolesPermitidos }) {
  const { user, rol, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F3F4F6]">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(rol)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function RutaPublica({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F3F4F6]">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RutaPublica><Login /></RutaPublica>} />
      <Route path="/registro" element={<RutaPublica><Registro /></RutaPublica>} />

      <Route path="/" element={<RutaPrivada><Dashboard /></RutaPrivada>} />
      <Route path="/paquetes" element={<RutaPrivada><Paquetes /></RutaPrivada>} />

      <Route path="/sellers" element={
        <RutaPrivada rolesPermitidos={['empresa']}>
          <h2>Pantalla de Sellers en construcción...</h2>
        </RutaPrivada>
      } />
      <Route path="/facturas" element={
        <RutaPrivada rolesPermitidos={['empresa']}>
          <h2>Pantalla de Facturas en construcción...</h2>
        </RutaPrivada>
      } />
      <Route path="/transportistas" element={
        <RutaPrivada rolesPermitidos={['empresa']}>
          <Transportistas />
        </RutaPrivada>
      } />
      <Route path="/estadisticas" element={
        <RutaPrivada rolesPermitidos={['empresa']}>
          <h2>Pantalla de Estadísticas en construcción...</h2>
        </RutaPrivada>
      } />
      <Route path="/listas-precios" element={
        <RutaPrivada rolesPermitidos={['empresa']}>
          <h2>Pantalla de Listas de Precios en construcción...</h2>
        </RutaPrivada>
      } />
      <Route path="/liquidaciones" element={
        <RutaPrivada rolesPermitidos={['empresa']}>
          <h2>Pantalla de Liquidaciones en construcción...</h2>
        </RutaPrivada>
      } />
      <Route path="/perfil" element={
        <RutaPrivada>
          <h2>Pantalla de Perfil en construcción...</h2>
        </RutaPrivada>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
