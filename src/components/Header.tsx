
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="border-b bg-background p-4">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img 
            src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png" 
            alt="Drohnenvermessung by RooferGaming" 
            className="h-10 mr-2"
          />
          <span className="text-xl font-bold hidden md:inline">Drohnen App</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm hidden sm:inline">
                Angemeldet als: <b>{user?.email}</b>
              </span>
              {user?.isAdmin && (
                <Button variant="outline" asChild size="sm" className="h-8">
                  <Link to="/admin">Admin</Link>
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} size="sm" className="h-8">
                Abmelden
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" asChild size="sm" className="h-8">
                <Link to="/login">Anmelden</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
