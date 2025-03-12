
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";

export interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  isLoading: boolean;
  progress: number;
}

export const useLoginForm = () => {
  const [email, setEmail] = useState(() => localStorage.getItem('savedEmail') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('savedPassword') || '');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('savedEmail'));
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isProcessComplete, setIsProcessComplete] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && isProcessComplete) {
      console.log('User ist vollständig authentifiziert, Navigation zur Startseite');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isProcessComplete, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    setProgress(0);
    setIsProcessComplete(false);
    
    // Visual feedback
    setProgress(10);
    
    try {
      console.log("Login-Sequenz gestartet");
      
      setTimeout(() => setProgress(25), 50);
      
      // Save login data if requested
      if (rememberMe) {
        try {
          localStorage.setItem('savedEmail', email);
          localStorage.setItem('savedPassword', password);
        } catch (storageError) {
          console.warn("LocalStorage Fehler:", storageError);
        }
      } else {
        try {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        } catch (storageError) {
          console.warn("LocalStorage Fehler:", storageError);
        }
      }
      
      setTimeout(() => setProgress(40), 75);
      
      // Optimized progress update
      let progressInterval = setInterval(() => {
        setProgress(prev => {
          const increment = prev < 60 ? 2 : (prev < 85 ? 0.5 : 0.1);
          return Math.min(prev + increment, 87);
        });
      }, 25);
      
      const success = await login(email, password);
      clearInterval(progressInterval);
      
      setProgress(95);
      
      if (success) {
        setProgress(100);
        console.log("Login erfolgreich, Navigation wird vorbereitet");
        
        setTimeout(() => {
          setIsProcessComplete(true);
        }, 100);
      } else {
        console.error("Login fehlgeschlagen, aber kein Fehler wurde geworfen");
        setProgress(100);
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: "Ungültige E-Mail oder Passwort.",
          variant: "destructive",
        });
        setIsLoading(false);
      }
      
    } catch (error: any) {
      console.error("Login Fehler:", error);
      
      toast({
        title: "Fehler",
        description: error.message || "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
      
      if (!rememberMe) {
        try {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        } catch (storageError) {
          console.warn("LocalStorage Fehler während Bereinigung:", storageError);
        }
      }
      
      setProgress(100);
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
    handleSubmit
  };
};
