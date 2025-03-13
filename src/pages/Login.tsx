import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useLoginForm } from '@/hooks/useLoginForm';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const { toast } = useToast();
  const {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    isLoading,
    progress,
    handleSubmit
  } = useLoginForm();

  const { register } = useAuth();

  // Separate registration form state and handler
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  // Optimierte Statusnachrichten mit feingranularen Übergängen
  const getProgressStatus = (progress: number) => {
    if (progress < 10) return "Anmeldung wird initialisiert...";
    if (progress < 25) return "Verbindung wird hergestellt...";
    if (progress < 40) return "Benutzerinformationen werden gesendet...";
    if (progress < 60) return "Authentifizierung läuft...";
    if (progress < 85) return "Berechtigungen werden überprüft...";
    if (progress < 95) return "Benutzerinformationen werden geladen...";
    return "Anmeldung abgeschlossen";
  };

  const isPasswordValid = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@<span class="math-inline">\!%\*?&\]\)\[A\-Za\-z\\d@</span>!%*?&]{6,}$/;
    return regex.test(password);
  };

  const getRegisterProgressStatus = (isLoading: boolean) => {
    if (isLoading) {
      return "Registrierung läuft...";
    }
    return "";
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die Passwörter stimmen nicht überein.",
        variant: "destructive"
      });
      return;
    }

    if (!isPasswordValid(registerPassword)) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 6 Zeichen lang sein. Ebenfalls sind Groß- und Kleinbuchstaben, 1 Sonderzeichen und 1 Zahl erforderlich",
        variant: "destructive"
      });
      return;
    }

    setIsRegisterLoading(true);

    try {
      const success = await register(registerEmail, registerPassword);

      if (success) {
        toast({
          title: "Erfolgreich registriert",
          description: "Sie können sich jetzt mit Ihren Zugangsdaten anmelden.",
        });
        setIsRegistering(false);
        setEmail(registerEmail);
        setRegisterEmail("");
        setRegisterPassword("");
        setConfirmPassword("");
      } else {
        toast({
          title: "Registrierung fehlgeschlagen",
          description: "Bitte überprüfen Sie Ihre E-Mail-Adresse und versuchen Sie es erneut.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const LoadingIndicator = ({ isLoading, text }) => (
    isLoading ? (
      <span className="flex items-center justify-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {text}
      </span>
    ) : null
  );

  return (
    <div className="hidden md:flex md:flex-col md:justify-center md:items-center md:w-1/2 md:bg-blue-500">
    <div className="text-center">
        <img
            src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
            alt="Drohnenvermessung by RooferGaming"
            className="h-48 mb-2"
        />
        <span className="text-white text-lg font-semibold" style={{ color: '#003366' }}>
            DrohnenGLB by RooferGaming®
        </span>
    </div>
</div>

      {/* Rechte Seite (Login-Formular) oder Volle Breite auf Mobilgeräten */}
      <div className="flex flex-col justify-center items-center md:w-1/2 w-full p-4">
        <Card className="w-full max-w-md space-y-6 p-8">
          <div className="text-center md:hidden"> {/* Nur auf Mobilgeräten anzeigen */}
            <img
              src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
              alt="Drohnenvermessung by RooferGaming"
              className="h-32 mx-auto mb-4"
            />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold">{isRegistering ? "Registrieren" : "Einloggen"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRegistering
                ? "Erstellen Sie ein neues Konto"
                : "Geben Sie Ihre Zugangsdaten ein"}
            </p>
          </div>

          {!isRegistering ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  E-Mail
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="E-Mail eingeben"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Passwort
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Passwort eingeben"
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isLoading}
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Zugangsdaten merken
                </label>
              </div>

              {isLoading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2 w-full" />
                  <p className="text-xs text-center text-muted-foreground">
                    {getProgressStatus(progress)}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Anmeldung läuft...
                  </span>
                ) : "Anmelden"}
              </Button>

              <div className="text-center mt-4">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-primary"
                  onClick={() => setIsRegistering(true)}
                >
                  Neu hier? Jetzt registrieren
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="registerEmail">E-Mail</Label>
                <Input
                  id="registerEmail"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  disabled={isRegisterLoading}
                  placeholder="E-Mail eingeben"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPassword">Passwort</Label>
                <Input
                  id="registerPassword"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                  disabled={isRegisterLoading}
                  placeholder="Passwort eingeben"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isRegisterLoading}
                  placeholder="Passwort bestätigen"
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isRegisterLoading}
              >
                {isRegisterLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrierung läuft...
                  </span>
                ) : "Registrieren"}
              </Button>

              <div className="text-center mt-4">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-primary"
                  onClick={() => setIsRegistering(false)}
                >
                  Zurück zur Anmeldung
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;
