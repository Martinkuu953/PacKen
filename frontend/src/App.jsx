import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CatalogosProvider } from './context/CatalogosContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';

// Cada pantalla se descarga recién cuando se abre (code splitting): el
// transportista, que entra desde el celular y con datos móviles, no baja el
// código de Facturas, Listas o Estadísticas que nunca va a usar.
const Registro = lazy(() => import('./pages/Registro'));
const SinAcceso = lazy(() => import('./pages/SinAcceso'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Paquetes = lazy(() => import('./pages/Paquetes'));
const Sellers = lazy(() => import('./pages/Sellers'));
const ListasPrecios = lazy(() => import('./pages/ListasPrecios'));
const EstablecerZonas = lazy(() => import('./pages/EstablecerZonas'));
const Transportistas = lazy(() => import('./pages/Transportistas'));
const Estadisticas = lazy(() => import('./pages/Estadisticas'));
const Liquidaciones = lazy(() => import('./pages/Liquidaciones'));
const Facturas = lazy(() => import('./pages/Facturas'));
const Perfil = lazy(() => import('./pages/Perfil'));

function RutaProtegida({ children, rolesPermitidos }) {
  const { autenticado, usuario, aprobado } = useAuth();

  if (!autenticado) return <Navigate to="/login" replace />;
  if (!aprobado) return <Navigate to="/sin-acceso" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}

function RutaPublica({ children }) {
  const { autenticado } = useAuth();
  if (autenticado) return <Navigate to="/" replace />;
  return children;
}

// La home pública: sin sesión se ve la landing, no el redirect a /login que
// usa el resto de las rutas protegidas.
function Inicio() {
  const { autenticado, aprobado } = useAuth();

  if (!autenticado) return <Landing />;
  if (!aprobado) return <Navigate to="/sin-acceso" replace />;

  return <Layout><Dashboard /></Layout>;
}

function RutaSinAcceso() {
  const { autenticado, aprobado } = useAuth();
  if (!autenticado) return <Navigate to="/login" replace />;
  if (aprobado) return <Navigate to="/" replace />;
  return <SinAcceso />;
}

// Mientras se rehidrata la sesión desde la cookie httpOnly no sabemos todavía
// si hay usuario: renderizar las rutas acá mandaría a /login de rebote a
// alguien que sí tiene sesión válida.
function PantallaCargando() {
  return (
    <div className="min-h-screen bg-marca-crema flex items-center justify-center">
      <p className="text-gray-500 text-sm">Cargando...</p>
    </div>
  );
}

function AppRoutes() {
  const { cargandoSesion } = useAuth();

  if (cargandoSesion) return <PantallaCargando />;

  return (
    <Suspense fallback={<PantallaCargando />}>
      <Routes>
        <Route path="/login" element={<RutaPublica><Login /></RutaPublica>} />
        <Route path="/registro" element={<RutaPublica><Registro /></RutaPublica>} />
        <Route path="/sin-acceso" element={<RutaSinAcceso />} />

        <Route path="/" element={<Inicio />} />
        <Route path="/paquetes" element={<RutaProtegida><Paquetes /></RutaProtegida>} />

        <Route path="/sellers" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <Sellers />
          </RutaProtegida>
        } />
        <Route path="/facturas" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <Facturas />
          </RutaProtegida>
        } />
        <Route path="/transportistas" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <Transportistas />
          </RutaProtegida>
        } />
        <Route path="/estadisticas" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <Estadisticas />
          </RutaProtegida>
        } />
        <Route path="/listas" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <ListasPrecios />
          </RutaProtegida>
        } />
        {/* Alias histórico → pantalla unificada de precios/costos */}
        <Route path="/listas-precios" element={<Navigate to="/listas" replace />} />
        <Route path="/listas-costos" element={<Navigate to="/listas" replace />} />
        <Route path="/zonas" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <EstablecerZonas />
          </RutaProtegida>
        } />
        <Route path="/liquidaciones" element={
          <RutaProtegida rolesPermitidos={['empresa']}>
            <Liquidaciones />
          </RutaProtegida>
        } />
        <Route path="/perfil" element={
          <RutaProtegida>
            <Perfil />
          </RutaProtegida>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* Adentro de AuthProvider: necesita saber si el usuario es empresa. */}
        <CatalogosProvider>
          <AppRoutes />
        </CatalogosProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
