
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
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
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

  return (
    <div className="container mx-auto h-full flex items-center justify-center py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Anmeldung</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Melde dich mit deinen Zugangsdaten an
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
            ) : "Anmelden"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
