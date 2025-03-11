
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';

const InitialAdminSetup = () => {
  const { setupInitialAdmin, needsInitialAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Wenn kein Admin benötigt wird, nichts anzeigen
  if (!needsInitialAdmin) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      toast({
        title: "Fehler",
        description: "Die Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log("Richte initialen Admin ein:", email);
      const success = await setupInitialAdmin(email, password);
      if (success) {
        toast({
          title: "Erfolg",
          description: "Admin-Konto erfolgreich erstellt. Sie können sich jetzt anmelden.",
        });
        console.log("Einrichtung des initialen Admins erfolgreich");
        setError(null);
      } else {
        const errorMsg = "Admin-Konto konnte nicht erstellt werden. Bitte überprüfen Sie die Firebase-Konfiguration.";
        setError(errorMsg);
        toast({
          title: "Fehler",
          description: errorMsg,
          variant: "destructive",
        });
        console.log("Einrichtung des initialen Admins fehlgeschlagen");
      }
    } catch (error) {
      console.error("Fehler während der Admin-Einrichtung:", error);
      const errorMsg = "Ein unerwarteter Fehler ist aufgetreten. Bitte überprüfen Sie die Firebase-Konfiguration.";
      setError(errorMsg);
      toast({
        title: "Fehler",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Drohnen App - Ersteinrichtung</CardTitle>
          <CardDescription>
            Erstellen Sie ein Administrator-Konto, um mit der Nutzung der Anwendung zu beginnen.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 p-3 rounded-md flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Wird erstellt..." : "Admin-Konto erstellen"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default InitialAdminSetup;
