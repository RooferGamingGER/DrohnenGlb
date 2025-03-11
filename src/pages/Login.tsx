
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

const Login = () => {
  const [email, setEmail] = useState(() => localStorage.getItem('savedEmail') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('savedPassword') || '');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('savedEmail'));
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, number>>({});
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    setProgress(10);
    
    const metrics: Record<string, number> = {};
    const startTime = performance.now();
    
    try {
      const previousEmail = localStorage.getItem('savedEmail');
      const previousPassword = localStorage.getItem('savedPassword');
      
      setProgress(20);
      metrics.speichernStart = performance.now() - startTime;
      
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
      }
      
      setProgress(30);
      metrics.vorLogin = performance.now() - startTime;
      console.log("Starte Login-Prozess...");
      
      const loginStartTime = performance.now();
      const success = await login(email, password);
      const loginEndTime = performance.now();
      metrics.loginDauer = loginEndTime - loginStartTime;
      metrics.gesamtDauer = loginEndTime - startTime;
      
      setProgress(90);
      setPerformanceMetrics(metrics);
      
      if (success) {
        console.log("Login erfolgreich, leite weiter...");
        setProgress(100);
        navigate('/', { replace: true });
      } else {
        setProgress(100);
        if (rememberMe) {
          if (previousEmail) localStorage.setItem('savedEmail', previousEmail);
          else localStorage.removeItem('savedEmail');
          
          if (previousPassword) localStorage.setItem('savedPassword', previousPassword);
          else localStorage.removeItem('savedPassword');
        }
        
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: "Ungültige E-Mail oder Passwort.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login-Fehler:", error);
      metrics.fehlerZeit = performance.now() - startTime;
      
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
      
      if (!rememberMe) {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('savedPassword');
      }
    } finally {
      metrics.gesamtDauer = performance.now() - startTime;
      setPerformanceMetrics(metrics);
      setIsLoading(false);
    }
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
                {progress < 100 ? "Anmeldung läuft..." : "Überprüfung abgeschlossen"}
              </p>
            </div>
          )}
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Anmeldung läuft..." : "Anmelden"}
          </Button>
        </form>

        {Object.keys(performanceMetrics).length > 0 && (
          <Card className="mt-4 p-4 bg-muted">
            <h3 className="font-medium mb-2">Performance-Metriken:</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(performanceMetrics).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span>{key}:</span>
                  <span>{value.toFixed(2)} ms</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default Login;
