import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Solo cuentas con rol admin/superadmin. El backend vuelve a validar el rol en cada llamada.
export default function AdminGuard({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.rol !== 'admin' && user?.rol !== 'superadmin') return <Navigate to="/dashboard" replace />;
  return children;
}
