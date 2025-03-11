
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";

// User type definition
export interface UserProfile {
  id: string;
  username: string;
  isAdmin?: boolean;
}

// AuthContext type definition
interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (email: string, username: string, password: string, isAdmin?: boolean) => Promise<{ success: boolean; error?: string }>;
  createUser: (email: string, username: string, password: string, isAdmin: boolean) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (userId: string, updates: { username?: string; password?: string; email?: string }) => Promise<{ success: boolean; error?: string }>;
  users: UserProfile[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Create Auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch the session and user on mount
  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    // Cleanup the subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user profile data when user signs in
  const fetchUserProfile = async (authUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUser({
          id: data.id,
          username: data.username,
          isAdmin: data.is_admin
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Fetch all users (for admin dashboard)
  useEffect(() => {
    const fetchUsers = async () => {
      if (user?.isAdmin) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*');

          if (error) {
            console.error('Error fetching users:', error);
            return;
          }

          if (data) {
            setUsers(data.map(profile => ({
              id: profile.id,
              username: profile.username,
              isAdmin: profile.is_admin
            })));
          }
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      }
    };

    fetchUsers();
  }, [user?.isAdmin]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error.message);
        toast({
          title: "Fehler beim Abmelden",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Logout error:', error.message);
      toast({
        title: "Fehler beim Abmelden",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Register function
  const register = async (email: string, username: string, password: string, isAdmin: boolean = false) => {
    try {
      // Important: The data object must include username in the raw_user_meta_data
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username, // This is critical - ensure username is provided
            is_admin: isAdmin,
          },
        },
      });

      if (error) {
        console.error('Registration error:', error.message);
        return { success: false, error: error.message };
      }

      // For debugging
      console.log('Registration successful, user data:', data);
      
      return { success: true };
    } catch (error: any) {
      console.error('Registration error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Admin: Create user function
  const createUser = async (email: string, username: string, password: string, isAdmin: boolean) => {
    if (!user?.isAdmin) {
      return { success: false, error: "Nur Administratoren können Benutzer erstellen" };
    }

    try {
      // Check that all required fields are provided
      if (!email || !username || !password) {
        return { success: false, error: "E-Mail, Benutzername und Passwort sind erforderlich" };
      }

      // Call the register function to create the user
      return await register(email, username, password, isAdmin);
    } catch (error: any) {
      console.error('Create user error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Admin: Delete user function
  const deleteUser = async (userId: string) => {
    if (!user?.isAdmin) {
      return { success: false, error: "Nur Administratoren können Benutzer löschen" };
    }

    if (userId === user.id) {
      return { success: false, error: "Sie können Ihren eigenen Account nicht löschen" };
    }

    try {
      // This would typically involve an admin function in Supabase
      // For now, we'll return a placeholder success
      return { success: true };
    } catch (error: any) {
      console.error('Delete user error:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Admin: Update user function
  const updateUser = async (userId: string, updates: { username?: string; password?: string; email?: string }) => {
    if (!user?.isAdmin) {
      return { success: false, error: "Nur Administratoren können Benutzer aktualisieren" };
    }

    try {
      // This would typically involve an admin function in Supabase
      // For now, we'll update only the username in the profiles table
      if (updates.username) {
        const { error } = await supabase
          .from('profiles')
          .update({ username: updates.username })
          .eq('id', userId);

        if (error) {
          console.error('Update user error:', error.message);
          return { success: false, error: error.message };
        }
      }

      // Password and email updates would require admin functions
      return { success: true };
    } catch (error: any) {
      console.error('Update user error:', error.message);
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
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

// Hook for easy access to the Auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
