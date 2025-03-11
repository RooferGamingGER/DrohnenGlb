
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

// Benutzertyp-Definition
export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

// AuthContext Typdefinition
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  createUser: (email: string, password: string, isAdmin: boolean) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  updateUser: (userId: string, updates: { username?: string; password?: string }) => Promise<boolean>;
  users: Array<{ id: string; username: string; isAdmin?: boolean }>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Auth-Kontext erstellen
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Import der bestehenden lokalen Benutzer
const USERS_STORAGE_KEY = 'app_users';
const defaultUsers = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    isAdmin: true,
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; username: string; isAdmin?: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Prüfen, ob bestehende lokale Benutzer vorhanden sind und diese zu Supabase migrieren
  useEffect(() => {
    const migrateLocalUsers = async () => {
      try {
        const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
        const localUsers = storedUsers ? JSON.parse(storedUsers) : defaultUsers;
        
        // Nur ausführen, wenn wir einen Administrator gefunden haben
        const adminUser = localUsers.find(u => u.isAdmin);
        if (adminUser) {
          // Prüfen, ob bereits Benutzer in Supabase existieren
          const { data: existingUsers } = await supabase.from('app_users').select('*');
          
          if (!existingUsers || existingUsers.length === 0) {
            // Erstelle den Admin-Benutzer in Supabase mit der benutzerdefinierten Funktion
            const { data, error } = await supabase.rpc('create_admin_user', {
              email: adminUser.username,
              password: adminUser.password
            });
            
            if (error) {
              console.error('Fehler beim Erstellen des Admin-Benutzers:', error);
            } else {
              console.log('Admin-Benutzer erfolgreich migriert:', data);
            }
          }
        }
      } catch (error) {
        console.error('Fehler bei der Migration der lokalen Benutzer:', error);
      }
    };

    // Führe Migration durch
    migrateLocalUsers();
  }, []);

  // Überprüfen des Authentifizierungsstatus beim Laden
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // Prüfen, ob der Benutzer angemeldet ist
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Benutzerinformationen abrufen
          const { data: userData, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Fehler beim Abrufen der Benutzerinformationen:', error);
            setUser(null);
          } else if (userData) {
            setUser({
              id: userData.id,
              username: userData.username,
              isAdmin: userData.is_admin,
            });
          }
        } else {
          setUser(null);
        }
        
        // Benutzer aus Supabase abrufen
        await fetchUsers();
      } catch (error) {
        console.error('Fehler beim Überprüfen der Authentifizierung:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // Auth-Status-Änderungen überwachen
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Benutzerinformationen abrufen
        const { data: userData, error } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (!error && userData) {
          setUser({
            id: userData.id,
            username: userData.username,
            isAdmin: userData.is_admin,
          });
        }
      } else {
        setUser(null);
      }
      
      // Benutzer neu laden
      fetchUsers();
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);
  
  // Funktion zum Abrufen der Benutzerliste
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('app_users').select('*');
      
      if (error) {
        console.error('Fehler beim Abrufen der Benutzer:', error);
      } else if (data) {
        const formattedUsers = data.map(user => ({
          id: user.id,
          username: user.username,
          isAdmin: user.is_admin,
        }));
        setUsers(formattedUsers);
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der Benutzer:', error);
    }
  };

  // Login-Funktion mit Supabase
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Anmeldefehler:', error.message);
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
      
      // Bei erfolgreicher Anmeldung werden die Benutzerinformationen im Auth-Listener aktualisiert
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler bei der Anmeldung:', error);
      return false;
    }
  };

  // Logout-Funktion mit Supabase
  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      // Benutzer wird im Auth-Listener auf null gesetzt
    } catch (error) {
      console.error('Fehler beim Abmelden:', error);
    }
  };

  // Registrierungsfunktion mit Supabase
  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        console.error('Registrierungsfehler:', error.message);
        toast({
          title: "Registrierung fehlgeschlagen",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
      
      toast({
        title: "Registrierung erfolgreich",
        description: "Ihr Konto wurde erfolgreich erstellt.",
      });
      
      // Benutzer automatisch anmelden, wenn die E-Mail-Bestätigung deaktiviert ist
      if (data.session) {
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler bei der Registrierung:', error);
      return false;
    }
  };

  // Admin-Funktion zum Erstellen von Benutzern
  const createUser = async (email: string, password: string, isAdmin: boolean): Promise<boolean> => {
    if (!user?.isAdmin) {
      toast({
        title: "Fehlgeschlagen",
        description: "Nur Administratoren können Benutzer erstellen.",
        variant: "destructive",
      });
      return false;
    }
    
    try {
      // Benutzer in Supabase Auth erstellen
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      
      if (authError) {
        console.error('Fehler beim Erstellen des Benutzers:', authError.message);
        toast({
          title: "Fehler",
          description: authError.message,
          variant: "destructive",
        });
        return false;
      }
      
      if (!authData.user) {
        return false;
      }
      
      // Die app_users-Tabelle wird automatisch über den Trigger aktualisiert
      // Admin-Status aktualisieren
      const { error: updateError } = await supabase
        .from('app_users')
        .update({ is_admin: isAdmin })
        .eq('id', authData.user.id);
      
      if (updateError) {
        console.error('Fehler beim Aktualisieren des Admin-Status:', updateError.message);
        return false;
      }
      
      // Benutzerliste aktualisieren
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler beim Erstellen des Benutzers:', error);
      return false;
    }
  };

  // Admin-Funktion zum Aktualisieren von Benutzern
  const updateUser = async (
    userId: string,
    updates: { username?: string; password?: string }
  ): Promise<boolean> => {
    if (!user?.isAdmin) {
      toast({
        title: "Fehlgeschlagen",
        description: "Nur Administratoren können Benutzer aktualisieren.",
        variant: "destructive",
      });
      return false;
    }
    
    try {
      // Benutzernamen aktualisieren, falls vorhanden
      if (updates.username) {
        const { error: updateError } = await supabase
          .from('app_users')
          .update({ username: updates.username })
          .eq('id', userId);
        
        if (updateError) {
          console.error('Fehler beim Aktualisieren des Benutzernamens:', updateError.message);
          return false;
        }
      }
      
      // Passwort aktualisieren, falls vorhanden
      if (updates.password) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          userId,
          { password: updates.password }
        );
        
        if (passwordError) {
          console.error('Fehler beim Aktualisieren des Passworts:', passwordError.message);
          return false;
        }
      }
      
      // Benutzerliste aktualisieren
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler beim Aktualisieren des Benutzers:', error);
      return false;
    }
  };

  // Admin-Funktion zum Löschen von Benutzern
  const deleteUser = async (userId: string): Promise<boolean> => {
    if (!user?.isAdmin) {
      toast({
        title: "Fehlgeschlagen",
        description: "Nur Administratoren können Benutzer löschen.",
        variant: "destructive",
      });
      return false;
    }
    
    if (userId === user.id) {
      toast({
        title: "Fehler",
        description: "Sie können Ihren eigenen Account nicht löschen.",
        variant: "destructive",
      });
      return false;
    }
    
    try {
      // Benutzer aus Supabase Auth löschen
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) {
        console.error('Fehler beim Löschen des Benutzers:', error.message);
        toast({
          title: "Fehler",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
      
      // Benutzerliste aktualisieren
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler beim Löschen des Benutzers:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        createUser,
        deleteUser,
        updateUser,
        users,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook für einfachen Zugriff auf den Auth-Kontext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
