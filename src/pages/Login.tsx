
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useLoginForm } from '@/hooks/useLoginForm';
import { Loader2, LogIn, User, KeyRound, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Optimized status messages with fine-grained transitions
  const getProgressStatus = (progress: number) => {
    if (progress < 10) return "Initialisierung...";
    if (progress < 25) return "Verbindung wird hergestellt...";
    if (progress < 40) return "Überprüfe Anmeldedaten...";
    if (progress < 60) return "Authentifizierung...";
    if (progress < 85) return "Berechtigungen werden geladen...";
    if (progress < 95) return "Fast fertig...";
    return "Anmeldung abgeschlossen";
  };

  const isPasswordValid = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    return regex.test(password);
  };

  // Calculate password strength
  useEffect(() => {
    if (!registerPassword) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    if (registerPassword.length >= 6) strength += 25;
    if (/[A-Z]/.test(registerPassword)) strength += 25;
    if (/[0-9]/.test(registerPassword)) strength += 25;
    if (/[^A-Za-z0-9]/.test(registerPassword)) strength += 25;
    
    setPasswordStrength(strength);
  }, [registerPassword]);

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return "";
    if (passwordStrength <= 25) return "Schwach";
    if (passwordStrength <= 75) return "Mittel";
    return "Stark";
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 25) return "bg-red-500";
    if (passwordStrength <= 75) return "bg-yellow-500";
    return "bg-green-500";
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
        description: "Das Passwort muss mindestens 6 Zeichen lang sein und Groß- und Kleinbuchstaben, 1 Sonderzeichen und 1 Zahl enthalten.",
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

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="hidden md:flex md:flex-col md:justify-center md:items-center md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-8">
        <div className="text-center flex flex-col items-center max-w-md">
          <img
            src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
            alt="Drohnenvermessung by RooferGaming"
            className="h-48 mb-4 filter drop-shadow-lg animate-float"
          />
          <h1 className="text-3xl font-bold text-white mb-4 text-balance">
            DrohnenGLB by RooferGaming®
          </h1>
          <p className="text-blue-100 mb-8 text-balance">
            Die präzise Lösung für Ihre Dachvermessung. Nehmen Sie genaue Messungen vor und erstellen Sie detaillierte Berichte direkt auf Ihrem Gerät.
          </p>
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <h3 className="font-semibold text-white mb-2">Präzise Messungen</h3>
              <p className="text-blue-100 text-sm">Exakte Messergebnisse für Ihre Projekte</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <h3 className="font-semibold text-white mb-2">Einfache Bedienung</h3>
              <p className="text-blue-100 text-sm">Intuitive Tools für jeden Anwender</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center w-full md:w-1/2 p-4">
        <Card className="w-full max-w-md p-8 shadow-xl bg-white/80 backdrop-blur-sm border border-gray-100">
          <div className="text-center md:hidden mb-8">
            <img
              src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
              alt="Drohnenvermessung by RooferGaming"
              className="h-32 mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-gray-800">DrohnenGLB</h2>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">{isRegistering ? "Konto erstellen" : "Willkommen zurück"}</h1>
            <p className="text-gray-500 text-sm">
              {isRegistering
                ? "Erstellen Sie ein neues Konto, um fortzufahren"
                : "Melden Sie sich an, um Ihre Projektdaten abzurufen"}
            </p>
          </div>

          {!isRegistering ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  E-Mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="beispiel@firma.de"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium flex items-center">
                  <KeyRound className="w-4 h-4 mr-2 text-gray-400" />
                  Passwort
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="h-11"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={isLoading}
                  className="data-[state=checked]:bg-blue-600"
                />
                <label
                  htmlFor="rememberMe"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Angemeldet bleiben
                </label>
              </div>

              {isLoading && (
                <div className="space-y-2 py-2">
                  <Progress value={progress} className="h-2 w-full" />
                  <p className="text-xs text-center text-gray-500 animate-pulse">
                    {getProgressStatus(progress)}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 transition-colors duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Anmeldung...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <LogIn className="mr-2 h-4 w-4" />
                    Anmelden
                  </span>
                )}
              </Button>

              <div className="text-center mt-6">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setIsRegistering(true)}
                >
                  Noch kein Konto? Jetzt registrieren
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="registerEmail" className="text-sm font-medium flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  E-Mail
                </Label>
                <Input
                  id="registerEmail"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  disabled={isRegisterLoading}
                  placeholder="beispiel@firma.de"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPassword" className="text-sm font-medium flex items-center">
                  <KeyRound className="w-4 h-4 mr-2 text-gray-400" />
                  Passwort
                </Label>
                <Input
                  id="registerPassword"
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                  disabled={isRegisterLoading}
                  placeholder="••••••••"
                  className="h-11"
                  minLength={6}
                />
                {registerPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-300", getPasswordStrengthColor())}
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className={cn(
                        "font-medium",
                        passwordStrength <= 25 ? "text-red-500" : 
                        passwordStrength <= 75 ? "text-yellow-500" : "text-green-500"
                      )}>
                        {getPasswordStrengthText()}
                      </span>
                      {!isPasswordValid(registerPassword) && (
                        <span className="text-red-500 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Passwort zu schwach
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium flex items-center">
                  <KeyRound className="w-4 h-4 mr-2 text-gray-400" />
                  Passwort bestätigen
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isRegisterLoading}
                  placeholder="••••••••"
                  className="h-11"
                  minLength={6}
                />
                {confirmPassword && confirmPassword !== registerPassword && (
                  <p className="text-xs text-red-500 mt-1 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Passwörter stimmen nicht überein
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 transition-colors duration-300"
                disabled={isRegisterLoading}
              >
                {isRegisterLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrierung...
                  </span>
                ) : (
                  "Konto erstellen"
                )}
              </Button>

              <div className="text-center mt-6">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => setIsRegistering(false)}
                >
                  Zurück zur Anmeldung
                </Button>
              </div>
            </form>
          )}
        </Card>
        
        <p className="text-xs text-gray-500 mt-8 text-center">
          © 2023 RooferGaming® | Alle Rechte vorbehalten
        </p>
      </div>
    </div>
  );
};

export default Login;
