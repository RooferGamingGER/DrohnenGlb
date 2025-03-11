
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Wenn noch geladen wird, zeigen wir nichts an
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Lädt...</div>;
  }

  if (!isAuthenticated) {
    // Nicht authentifizierte Benutzer zur Login-Seite umleiten
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
