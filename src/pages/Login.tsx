
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useLoginForm } from '@/hooks/useLoginForm';
import PerformanceMetrics from '@/components/PerformanceMetrics';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    isLoading,
    progress,
    performanceMetrics,
    handleSubmit
  } = useLoginForm();

  const getProgressStatus = (progress: number) => {
    if (progress < 15) return "Anmeldung wird initialisiert...";
    if (progress < 30) return "Benutzerinformationen werden gesendet...";
    if (progress < 60) return "Authentifizierung läuft...";
    if (progress < 85) return "Berechtigungen werden überprüft...";
    if (progress < 95) return "Benutzerinformationen werden geladen...";
    return "Anmeldung abgeschlossen";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-6 p-8">
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
              Anmeldedaten speichern
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
        </form>

        {Object.keys(performanceMetrics).length > 0 && (
          <PerformanceMetrics metrics={performanceMetrics} />
        )}
      </Card>
    </div>
  );
};

export default Login;
