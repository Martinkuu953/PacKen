import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import PendienteAprobacion from './pages/PendienteAprobacion';
import Dashboard from './pages/Dashboard';
import Paquetes from './pages/Paquetes';
import Solicitudes from './pages/Solicitudes';

function RutaProtegida({ children, rolesPermitidos }) {
  const { autenticado, usuario, aprobado } = useAuth();

  if (!autenticado) return <Navigate to="/login" replace />;
  if (!aprobado) return <Navigate to="/pendiente" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function RutaPublica({ children }) {
  const { autenticado } = useAuth();
  if (autenticado) return <Navigate to="/" replace />;
  return children;
}

function RutaPendiente() {
  const { autenticado, aprobado } = useAuth();
  if (!autenticado) return <Navigate to="/login" replace />;
  if (aprobado) return <Navigate to="/" replace />;
  return <PendienteAprobacion />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RutaPublica><Login /></RutaPublica>} />
      <Route path="/registro" element={<RutaPublica><Registro /></RutaPublica>} />
      <Route path="/pendiente" element={<RutaPendiente />} />

      <Route path="/" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
      <Route path="/paquetes" element={<RutaProtegida><Paquetes /></RutaProtegida>} />

      <Route path="/solicitudes" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Solicitudes />
        </RutaProtegida>
      } />
      <Route path="/sellers" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <h2>Pantalla de Sellers en construcción...</h2>
        </RutaProtegida>
      } />
      <Route path="/facturas" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <h2>Pantalla de Facturas en construcción...</h2>
        </RutaProtegida>
      } />
      <Route path="/transportistas" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <h2>Pantalla de Transportistas en construcción...</h2>
        </RutaProtegida>
      } />
      <Route path="/estadisticas" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <h2>Pantalla de Estadísticas en construcción...</h2>
        </RutaProtegida>
      } />
      <Route path="/listas-precios" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <h2>Pantalla de Listas de Precios en construcción...</h2>
        </RutaProtegida>
      } />
      <Route path="/liquidaciones" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <h2>Pantalla de Liquidaciones en construcción...</h2>
        </RutaProtegida>
      } />
      <Route path="/perfil" element={
        <RutaProtegida>
          <h2>Pantalla de Perfil en construcción...</h2>
        </RutaProtegida>
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
