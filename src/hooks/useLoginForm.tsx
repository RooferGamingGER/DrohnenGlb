
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
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const memoizedNavigation = useCallback(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, navigating to home');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    memoizedNavigation();
  }, [isAuthenticated, memoizedNavigation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    setProgress(0); // Start from 0
    
    // Quick progress bump to give immediate feedback
    setTimeout(() => setProgress(15), 10);
    
    const metrics: Record<string, number> = {};
    const startTime = performance.now();
    
    try {
      console.log("Login sequence started");
      
      // Progress markers with faster initial feedback
      setTimeout(() => setProgress(25), 100);
      
      // Save credentials before network request if needed
      if (rememberMe) {
        try {
          localStorage.setItem('savedEmail', email);
          localStorage.setItem('savedPassword', password);
        } catch (storageError) {
          console.warn("LocalStorage error:", storageError);
          // Non-blocking, continue with login
        }
      } else {
        try {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        } catch (storageError) {
          console.warn("LocalStorage error:", storageError);
        }
      }
      
      metrics.preparationTime = performance.now() - startTime;
      console.log("Login preparation complete in", metrics.preparationTime, "ms");
      
      // Additional progress bump before network request
      setTimeout(() => setProgress(40), 150);
      
      // Login with timeout and detailed logging
      const loginStartTime = performance.now();
      console.log("Firebase login request starting at", loginStartTime - startTime, "ms");
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error("Login request timed out after 10 seconds");
      }, 10000);
      
      // Use Promise.race to handle timeouts
      const loginPromise = login(email, password);
      
      // Show progress during network request
      let progressInterval = setInterval(() => {
        setProgress(prev => {
          // Increment slowly until 85%, leaving room for completion steps
          return prev < 85 ? prev + 1 : prev;
        });
      }, 100);
      
      const success = await loginPromise;
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      
      const loginEndTime = performance.now();
      metrics.loginDuration = loginEndTime - loginStartTime;
      console.log("Firebase login completed in", metrics.loginDuration, "ms");
      
      // Jump to near completion
      setProgress(90);
      
      if (success) {
        setProgress(95);
        console.log("Login successful, navigation starting at", performance.now() - startTime, "ms");
        const navigationStartTime = performance.now();
        
        // Set a small timeout before navigation to allow UI to update
        setTimeout(() => {
          navigate('/', { replace: true });
          metrics.navigationTime = performance.now() - navigationStartTime;
          console.log("Navigation completed in", metrics.navigationTime, "ms");
        }, 100);
      } else {
        console.error("Login failed but no error was thrown");
        setProgress(100);
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: "Ungültige E-Mail oder Passwort.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error("Login error:", error);
      metrics.errorTime = performance.now() - startTime;
      
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
      
      if (!rememberMe) {
        try {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('savedPassword');
        } catch (storageError) {
          console.warn("LocalStorage error during cleanup:", storageError);
        }
      }
    } finally {
      setProgress(100);
      metrics.totalDuration = performance.now() - startTime;
      setPerformanceMetrics(metrics);
      
      // Set timeout to reset loading state to prevent UI flashing if navigation happens quickly
      setTimeout(() => {
        if (!isAuthenticated) {
          setIsLoading(false);
        }
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
