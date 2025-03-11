
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Zeige Ladebildschirm während der Authentifizierungsstatus geprüft wird
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Lade...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Nicht authentifizierte Benutzer zur Login-Seite umleiten
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
