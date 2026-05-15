import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Paquetes from './pages/Paquetes'; // <-- Agregamos esta importación

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          {/* Reemplazamos el texto de prueba por tu componente real */}
          <Route path="/paquetes" element={<Paquetes />} /> 
          
          <Route path="/sellers" element={<h2>Pantalla de Sellers en construcción...</h2>} />
          <Route path="/facturas" element={<h2>Pantalla de Facturas en construcción...</h2>} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;