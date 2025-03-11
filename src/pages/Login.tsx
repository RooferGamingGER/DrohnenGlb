
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    const savedPassword = localStorage.getItem('savedPassword');
    
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  // Redirect to homepage if already logged in
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      
      if (success) {
        // Save login credentials if Remember Me is checked
        if (rememberMe) {
          localStorage.setItem('savedEmail', email);
          localStorage.setItem('savedPassword', password);
        } else {
          // Remove saved credentials if Remember Me is unchecked
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        }
        
        toast({
          title: "Anmeldung erfolgreich",
          description: "Sie wurden erfolgreich angemeldet.",
        });
        navigate('/');
      } else {
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: "Ungültiger Benutzername oder Passwort.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Anmeldefehler:', error);
      toast({
        title: "Fehler",
        description: "Bei der Anmeldung ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p>Lade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Anmelden</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Melden Sie sich mit Ihrem Konto an
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              E-Mail
            </label>
            <Input
              id="email"
              type="email"
              placeholder="E-Mail-Adresse eingeben"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Passwort
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Passwort eingeben"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="rememberMe" 
              checked={rememberMe} 
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label
              htmlFor="rememberMe"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Anmeldedaten speichern
            </label>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Anmeldung läuft..." : "Anmelden"}
          </Button>
        </form>
        
        <div className="mt-4 text-center text-sm">
          <p>
            Nur ein Administrator kann neue Konten erstellen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
