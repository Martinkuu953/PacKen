import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Envuelve las rutas que requieren sesión. Si no hay usuario, redirige a /login
// recordando a dónde quería ir. `roles` opcional restringe por rol.
export default function RutaProtegida({ children, roles }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando…
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: location }} />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
