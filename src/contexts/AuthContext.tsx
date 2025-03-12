
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  auth,
  loginWithFirebase, 
  logoutFromFirebase,
  createUserInFirebase,
  getAllUsers
} from '../services/firebase';
import { useToast } from '@/hooks/use-toast';

export interface User {
  id: string;
  email: string;
  username?: string;
  isAdmin: boolean;
}

interface FirestoreUser {
  id: string;
  uid: string;
  email: string;
  isAdmin: boolean;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();

  const userAdminCache = new Map<string, boolean>();
  
  const checkIfUserIsAdmin = useCallback(async (uid: string): Promise<boolean> => {
    try {
      if (userAdminCache.has(uid)) {
        console.log("Admin-Status aus Cache geladen:", uid);
        return userAdminCache.get(uid) || false;
      }
      
      console.log("Admin-Status wird geprüft für:", uid);
      const startTime = performance.now();
      
      const usersList = await Promise.race([
        getAllUsers(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Admin-Status Timeout nach 2 Sekunden")), 2000)
        )
      ]);
      
      const userInfo = usersList.find((u: FirestoreUser) => u.uid === uid || u.id === uid) as FirestoreUser | undefined;
      const isAdmin = userInfo?.isAdmin || false;
      
      userAdminCache.set(uid, isAdmin);
      
      console.log(`Admin-Status geprüft in ${performance.now() - startTime}ms: ${isAdmin ? "Admin" : "Kein Admin"}`);
      return isAdmin;
    } catch (error: any) {
      console.error("Fehler beim Prüfen des Admin-Status:", error);
      
      if (error.message === "Admin-Status Timeout nach 2 Sekunden") {
        toast({
          title: "Hinweis",
          description: "Verzögerung bei der Berechtigungsprüfung. Einige Funktionen könnten eingeschränkt sein.",
          variant: "default",
        });
      }
      
      return false;
    }
  }, [toast]);

  useEffect(() => {
    let isSubscribed = true;
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser && isSubscribed) {
        try {
          console.log("Benutzerauthentifizierung erkannt, prüfe Admin-Status...");
          const adminCheckStart = performance.now();
          const isAdmin = await checkIfUserIsAdmin(firebaseUser.uid);
          console.log(`Admin-Status vollständig geprüft in ${performance.now() - adminCheckStart}ms`);
          
          const userData = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            username: firebaseUser.email || '',
            isAdmin: isAdmin
          };
          console.log("Benutzer erfolgreich geladen:", userData.email);
          setUser(userData);
        } catch (error) {
          console.error("Fehler beim Laden des Benutzers:", error);
          setUser(null);
        }
      } else if (isSubscribed) {
        setUser(null);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [checkIfUserIsAdmin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log("Login-Prozess startet für:", email);
      const loginStartTime = performance.now();
      
      const firebaseUser = await loginWithFirebase(email, password);
      
      if (firebaseUser) {
        console.log("Firebase-Authentifizierung erfolgreich, lade Admin-Status...");
        
        const adminCheckStartTime = performance.now();
        const isAdmin = await checkIfUserIsAdmin(firebaseUser.user.uid);
        console.log(`Admin-Status geprüft in ${performance.now() - adminCheckStartTime}ms: ${isAdmin ? "Admin" : "Kein Admin"}`);
        
        setUser({
          id: firebaseUser.user.uid,
          email: firebaseUser.user.email || '',
          username: firebaseUser.user.email || '',
          isAdmin: isAdmin
        });
        
        console.log(`Gesamter Login-Prozess abgeschlossen in ${performance.now() - loginStartTime}ms`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login-Fehler in AuthContext:", error);
      throw error;
    }
  };

  const logout = async (): Promise<boolean> => {
    const success = await logoutFromFirebase();
    if (success) {
      setUser(null);
    }
    return success;
  };

  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log("Registrierungsprozess startet für:", email);
      const registerStartTime = performance.now();
      
      const firebaseUser = await createUserInFirebase(email, password, false);
      
      console.log(`Registrierung abgeschlossen in ${performance.now() - registerStartTime}ms`);
      return !!firebaseUser;
    } catch (error) {
      console.error("Registrierungsfehler in AuthContext:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
