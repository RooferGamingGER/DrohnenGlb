
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

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
    
    // Start measuring performance
    const metrics: Record<string, number> = {};
    const startTime = performance.now();
    metrics.startTime = startTime;
    
    try {
      const previousEmail = localStorage.getItem('savedEmail');
      const previousPassword = localStorage.getItem('savedPassword');
      
      // Save credentials if remember me is checked
      setProgress(20);
      metrics.beforeRememberMeTime = performance.now() - startTime;
      
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
      }
      
      setProgress(30);
      metrics.beforeLoginTime = performance.now() - startTime;
      console.log("Attempting login...");
      
      // Perform login
      const loginStartTime = performance.now();
      const success = await login(email, password);
      const loginEndTime = performance.now();
      metrics.loginTime = loginEndTime - loginStartTime;
      metrics.totalLoginTime = loginEndTime - startTime;
      
      console.log("Login performance metrics:", metrics);
      setProgress(90);
      
      if (success) {
        console.log("Login successful, navigating...");
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
      console.error("Login error:", error);
      metrics.errorTime = performance.now() - startTime;
      console.log("Login error metrics:", metrics);
      
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
      const endTime = performance.now();
      metrics.totalTime = endTime - startTime;
      console.log("Final login metrics:", metrics);
      setPerformanceMetrics(metrics);
      
      setProgress(100);
      setIsLoading(false);
    }
  };

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
        
        <div className="mt-4 text-center text-sm">
          <p>
            Nur ein Administrator kann neue Konten erstellen.
          </p>
        </div>
        
        {Object.keys(performanceMetrics).length > 0 && (
          <div className="mt-4 text-xs border-t pt-4 text-muted-foreground">
            <p className="font-medium">Debug-Informationen:</p>
            <ul className="space-y-1 mt-2">
              {Object.entries(performanceMetrics).map(([key, value]) => (
                <li key={key}>{key}: {value.toFixed(2)}ms</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
