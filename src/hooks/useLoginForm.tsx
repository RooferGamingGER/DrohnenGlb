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
      const previousEmail = localStorage.getItem('savedEmail');
      const previousPassword = localStorage.getItem('savedPassword');
      
      setProgress(20);
      metrics.speichernStart = performance.now() - startTime;
      
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
      }
      
      setProgress(40);
      metrics.vorLogin = performance.now() - startTime;
      console.log("Starte Login-Prozess...");
      
      const loginStartTime = performance.now();
      
      setProgress(50);
      
      const success = await login(email, password);
      
      setProgress(75);
      
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
