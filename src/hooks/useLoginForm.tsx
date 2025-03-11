
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
  performanceMetrics: Record<string, number>;
}

export const useLoginForm = () => {
  const [email, setEmail] = useState(() => localStorage.getItem('savedEmail') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('savedPassword') || '');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('savedEmail'));
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, number>>({});
  const [isProcessComplete, setIsProcessComplete] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Verbesserte Navigation - erst navigieren, wenn die Authentifizierung VOLLSTÄNDIG abgeschlossen ist
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
    
    // Sofortiges visuelles Feedback
    setTimeout(() => setProgress(10), 10);
    
    const metrics: Record<string, number> = {};
    const startTime = performance.now();
    
    try {
      console.log("Login-Sequenz gestartet");
      
      // Fortschrittsanzeige für besseres Benutzerfeedback
      setTimeout(() => setProgress(20), 100);
      
      // Anmeldedaten speichern, wenn gewünscht
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
      
      metrics.preparationTime = performance.now() - startTime;
      console.log("Login-Vorbereitung abgeschlossen in", metrics.preparationTime, "ms");
      
      // Fortschritt vor Netzwerkanfrage erhöhen
      setTimeout(() => setProgress(30), 150);
      
      // Login mit Timeout und detailliertem Logging
      const loginStartTime = performance.now();
      console.log("Firebase Login-Anfrage startet bei", loginStartTime - startTime, "ms");
      
      // Fortschritt während der Netzwerkanfrage anzeigen
      let progressInterval = setInterval(() => {
        setProgress(prev => {
          return prev < 80 ? prev + 1 : prev;
        });
      }, 50); // Schnellere Updates für besseres Feedback
      
      const success = await login(email, password);
      clearInterval(progressInterval);
      
      const loginEndTime = performance.now();
      metrics.loginDuration = loginEndTime - loginStartTime;
      console.log("Firebase Login abgeschlossen in", metrics.loginDuration, "ms");
      
      // Sprunghafter Fortschritt zum Abschluss
      setProgress(90);
      
      if (success) {
        setProgress(95);
        console.log("Login erfolgreich, Navigation wird vorbereitet bei", performance.now() - startTime, "ms");
        
        // Kurze Verzögerung für UI-Update
        setTimeout(() => {
          setProgress(100);
          
          // WICHTIG: Erst jetzt wird der Prozess als abgeschlossen markiert
          setIsProcessComplete(true);
          metrics.totalSuccessTime = performance.now() - startTime;
          
          console.log("Login-Prozess vollständig abgeschlossen in", metrics.totalSuccessTime, "ms");
        }, 200);
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
      metrics.errorTime = performance.now() - startTime;
      
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
    } finally {
      metrics.totalDuration = performance.now() - startTime;
      setPerformanceMetrics(metrics);
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
