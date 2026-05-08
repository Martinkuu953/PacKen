import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Ahora la ruta raíz ("/") carga el Dashboard real */}
          <Route path="/" element={<Dashboard />} />
          
          {/* Rutas pendientes */}
          <Route path="/sellers" element={<h2>Pantalla de Sellers en construcción...</h2>} />
          <Route path="/facturas" element={<h2>Pantalla de Facturas en construcción...</h2>} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;