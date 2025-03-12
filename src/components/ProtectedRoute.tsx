
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isApproved } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Nicht authentifizierte Benutzer zur Login-Seite umleiten
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isApproved) {
    // Benutzer ist angemeldet, aber noch nicht freigeschaltet
    // Hier könnte eine spezielle "Warten auf Freischaltung"-Seite angezeigt werden
    // Für die Einfachheit leiten wir zurück zur Login-Seite um
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
