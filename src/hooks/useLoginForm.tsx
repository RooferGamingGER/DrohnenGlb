
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
    setProgress(5); // Start at a lower value
    
    const metrics: Record<string, number> = {};
    const startTime = performance.now();
    
    // Create a function to update progress with animation
    const animateProgress = (from: number, to: number, duration: number) => {
      const startTime = performance.now();
      const updateProgress = () => {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentProgress = from + (to - from) * progress;
        
        setProgress(Math.round(currentProgress));
        
        if (progress < 1) {
          requestAnimationFrame(updateProgress);
        }
      };
      
      requestAnimationFrame(updateProgress);
    };
    
    try {
      // Immediately animate to 15%
      animateProgress(5, 15, 300);
      
      const previousEmail = localStorage.getItem('savedEmail');
      const previousPassword = localStorage.getItem('savedPassword');
      
      // Continue animating to 30%
      setTimeout(() => {
        animateProgress(15, 30, 300);
        metrics.speichernStart = performance.now() - startTime;
      }, 300);
      
      if (rememberMe) {
        localStorage.setItem('savedEmail', email);
        localStorage.setItem('savedPassword', password);
      }
      
      // Animate to 45% before login
      setTimeout(() => {
        animateProgress(30, 45, 400);
        metrics.vorLogin = performance.now() - startTime;
        console.log("Starte Login-Prozess...");
      }, 600);
      
      const loginStartTime = performance.now();
      
      // Small progress increments during login to give feedback
      const loginProgressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 65) return prev + 1;
          return prev;
        });
      }, 150);
      
      const success = await login(email, password);
      
      clearInterval(loginProgressInterval);
      animateProgress(65, 85, 300);
      
      const loginEndTime = performance.now();
      metrics.loginDauer = loginEndTime - loginStartTime;
      metrics.gesamtDauer = loginEndTime - startTime;
      
      setTimeout(() => {
        setProgress(100);
        setPerformanceMetrics(metrics);
        
        if (success) {
          console.log("Login erfolgreich, leite weiter...");
          navigate('/', { replace: true });
        } else {
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
      }, 300);
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
      
      setProgress(100);
    } finally {
      metrics.gesamtDauer = performance.now() - startTime;
      setPerformanceMetrics(metrics);
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
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
