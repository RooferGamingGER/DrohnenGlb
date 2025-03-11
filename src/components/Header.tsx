
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Header = () => {
  const { user, logout, isAuthenticated, needsInitialAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Wenn wir noch in der Ersteinrichtung sind, zeigen wir keinen Header an
  if (needsInitialAdmin) {
    return null;
  }

  return (
    <header className="border-b bg-background p-4">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">
          Drohnen App
        </Link>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm">
                Angemeldet als: <b>{user?.email}</b>
              </span>
              {user?.isAdmin && (
                <Button variant="outline" asChild>
                  <Link to="/admin">Admin Dashboard</Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout}>
                Abmelden
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" asChild>
                <Link to="/login">Anmelden</Link>
              </Button>
              {/* Register button removed */}
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
