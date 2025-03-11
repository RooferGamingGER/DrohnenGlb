
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Login = () => {
  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Register state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { success, error } = await login(email, password);
      
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
          description: error || "Ungültige E-Mail-Adresse oder Passwort.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (password !== registerPasswordConfirm) {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: "Die Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    
    try {
      const { success, error } = await register(registerEmail, registerUsername, registerPassword);
      
      if (success) {
        toast({
          title: "Registrierung erfolgreich",
          description: "Ihr Konto wurde erfolgreich erstellt. Sie können sich jetzt anmelden.",
        });
        // Switch to login tab after successful registration
        setEmail(registerEmail);
        setPassword(registerPassword);
        // Reset register form
        setRegisterEmail('');
        setRegisterUsername('');
        setRegisterPassword('');
        setRegisterPasswordConfirm('');
      } else {
        toast({
          title: "Registrierung fehlgeschlagen",
          description: error || "Die Registrierung konnte nicht abgeschlossen werden.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Willkommen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Melden Sie sich an oder erstellen Sie ein neues Konto
          </p>
        </div>
        
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Anmelden</TabsTrigger>
            <TabsTrigger value="register">Registrieren</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  E-Mail-Adresse
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
          </TabsContent>
          
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="registerEmail" className="text-sm font-medium">
                  E-Mail-Adresse
                </label>
                <Input
                  id="registerEmail"
                  type="email"
                  placeholder="E-Mail-Adresse eingeben"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="registerUsername" className="text-sm font-medium">
                  Benutzername
                </label>
                <Input
                  id="registerUsername"
                  placeholder="Benutzernamen eingeben"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="registerPassword" className="text-sm font-medium">
                  Passwort
                </label>
                <Input
                  id="registerPassword"
                  type="password"
                  placeholder="Passwort eingeben"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="registerPasswordConfirm" className="text-sm font-medium">
                  Passwort bestätigen
                </label>
                <Input
                  id="registerPasswordConfirm"
                  type="password"
                  placeholder="Passwort erneut eingeben"
                  value={registerPasswordConfirm}
                  onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isRegistering}
              >
                {isRegistering ? "Registrierung läuft..." : "Registrieren"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 text-center text-sm">
          <p>
            Nur ein Administrator kann neue Admin-Konten erstellen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
