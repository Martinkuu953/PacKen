import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Paquetes from './pages/Paquetes';

function AppRoutes() {
  const { autenticado } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={autenticado ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/registro" element={autenticado ? <Navigate to="/" replace /> : <Registro />} />

      <Route path="/" element={
        <RutaProtegida>
          <Layout><Dashboard /></Layout>
        </RutaProtegida>
      } />
      <Route path="/paquetes" element={
        <RutaProtegida>
          <Layout><Paquetes /></Layout>
        </RutaProtegida>
      } />
      <Route path="/sellers" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Layout><h2>Pantalla de Sellers en construcción...</h2></Layout>
        </RutaProtegida>
      } />
      <Route path="/facturas" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Layout><h2>Pantalla de Facturas en construcción...</h2></Layout>
        </RutaProtegida>
      } />
      <Route path="/transportistas" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Layout><h2>Pantalla de Transportistas en construcción...</h2></Layout>
        </RutaProtegida>
      } />
      <Route path="/estadisticas" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Layout><h2>Pantalla de Estadísticas en construcción...</h2></Layout>
        </RutaProtegida>
      } />
      <Route path="/perfil" element={
        <RutaProtegida>
          <Layout><h2>Pantalla de Mi Perfil en construcción...</h2></Layout>
        </RutaProtegida>
      } />
      <Route path="/listas-precios" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Layout><h2>Pantalla de Listas de precios en construcción...</h2></Layout>
        </RutaProtegida>
      } />
      <Route path="/liquidaciones" element={
        <RutaProtegida rolesPermitidos={['empresa']}>
          <Layout><h2>Pantalla de Liquidaciones en construcción...</h2></Layout>
        </RutaProtegida>
      } />
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
