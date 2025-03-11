
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

export interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  isLoading: boolean;
  progress: number;
  performanceMetrics: Record<string, number>;
}

export const useLoginForm = () => {
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
      // Sofort auf 20% springen für besseres Feedback
      setProgress(20);
      
      // Login-Credentials speichern wenn gewünscht
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
      } else {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('savedPassword');
      }
      
      metrics.vorbereitungZeit = performance.now() - startTime;
      
      // Direkt auf 40% springen vor Login
      setProgress(40);
      console.log("Login Start:", performance.now() - startTime, "ms");
      
      const loginStartTime = performance.now();
      const success = await login(email, password);
      const loginEndTime = performance.now();
      
      metrics.loginDauer = loginEndTime - loginStartTime;
      console.log("Login Dauer:", metrics.loginDauer, "ms");
      
      // Sofort auf 75% nach Login
      setProgress(75);
      
      if (success) {
        setProgress(90);
        console.log("Login erfolgreich, Navigation Start:", performance.now() - startTime, "ms");
        navigate('/', { replace: true });
      } else {
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
      setProgress(100);
      metrics.gesamtDauer = performance.now() - startTime;
      setPerformanceMetrics(metrics);
      setIsLoading(false);
    }
  };

  return {
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
  };
};
