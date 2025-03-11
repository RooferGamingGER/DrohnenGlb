
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Registration
        if (!username.trim()) {
          toast({
            title: "Fehler",
            description: "Bitte gib einen Benutzernamen ein.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        console.log('Registering with:', { email, username, password });
        const { success, error } = await register(email, username, password);

        if (success) {
          toast({
            title: "Registrierung erfolgreich",
            description: "Dein Account wurde erstellt. Du kannst dich jetzt anmelden.",
          });
          setIsRegistering(false);
        } else {
          toast({
            title: "Registrierung fehlgeschlagen",
            description: error || "Ein unbekannter Fehler ist aufgetreten.",
            variant: "destructive",
          });
        }
      } else {
        // Login
        const { success, error } = await login(email, password);

        if (success) {
          toast({
            title: "Anmeldung erfolgreich",
            description: "Du wirst weitergeleitet...",
          });
          navigate(from, { replace: true });
        } else {
          toast({
            title: "Anmeldung fehlgeschlagen",
            description: error || "E-Mail oder Passwort falsch.",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Ein unbekannter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
  };

  return (
    <div className="container mx-auto h-full flex items-center justify-center py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            {isRegistering ? "Registrierung" : "Anmeldung"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {isRegistering
              ? "Erstelle einen neuen Account"
              : "Melde dich mit deinen Zugangsdaten an"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-card p-8 rounded-lg border shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                E-Mail-Adresse
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>

            {isRegistering && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1">
                  Benutzername
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="Dein Benutzername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Passwort
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Spinner className="mr-2 h-4 w-4" /> Laden...
              </span>
            ) : (
              isRegistering ? "Registrieren" : "Anmelden"
            )}
          </Button>

          <div className="text-center mt-4">
            <Button
              type="button"
              variant="link"
              onClick={toggleMode}
              className="text-sm"
            >
              {isRegistering
                ? "Du hast bereits einen Account? Anmelden"
                : "Noch keinen Account? Registrieren"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
