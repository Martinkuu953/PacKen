import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/auth/RutaProtegida';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Paquetes from './pages/Paquetes';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Rutas protegidas (requieren sesión) */}
          <Route
            path="/*"
            element={
              <RutaProtegida>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/paquetes" element={<Paquetes />} />
                    <Route path="/sellers" element={<h2>Pantalla de Sellers en construcción...</h2>} />
                    <Route path="/facturas" element={<h2>Pantalla de Facturas en construcción...</h2>} />
                  </Routes>
                </Layout>
              </RutaProtegida>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
