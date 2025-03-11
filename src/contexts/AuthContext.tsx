import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; username: string; isAdmin?: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
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
        
        await fetchUsers();
      } catch (error) {
        console.error('Fehler beim Überprüfen der Authentifizierung:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
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
      
      await fetchUsers();
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Anmeldefehler:', error.message);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler bei der Anmeldung:', error);
      return false;
    }
  };

  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        console.error('Registrierungsfehler:', error.message);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler bei der Registrierung:', error);
      return false;
    }
  };

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
      
      const { error: updateError } = await supabase
        .from('app_users')
        .update({ is_admin: isAdmin })
        .eq('id', authData.user.id);
      
      if (updateError) {
        console.error('Fehler beim Aktualisieren des Admin-Status:', updateError.message);
        return false;
      }
      
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler beim Erstellen des Benutzers:', error);
      return false;
    }
  };

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
      
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler beim Aktualisieren des Benutzers:', error);
      return false;
    }
  };

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
      
      await fetchUsers();
      
      return true;
    } catch (error) {
      console.error('Unerwarteter Fehler beim Löschen des Benutzers:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Fehler beim Abmelden:', error);
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
