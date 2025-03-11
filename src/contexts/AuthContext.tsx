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

  useEffect(() => {
    if (user?.isAdmin) {
      fetchUsers();
    }
  }, [user?.isAdmin]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Fehler beim Abmelden",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Fehler beim Abmelden",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Admin: Create user function
  const createUser = async (email: string, username: string, password: string, isAdmin: boolean) => {
    if (!user?.isAdmin) {
      return { success: false, error: "Nur Administratoren können Benutzer erstellen" };
    }

    try {
      const { data: { user: newUser }, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          username: username,
          is_admin: isAdmin
        }
      });

      if (createError) {
        return { success: false, error: createError.message };
      }

      toast({
        title: "Benutzer erstellt",
        description: `Benutzer ${username} wurde erfolgreich erstellt.`,
      });

      // Refresh users list
      fetchUsers();
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // Admin: Delete user function
  const deleteUser = async (userId: string) => {
    if (!user?.isAdmin) {
      return { success: false, error: "Nur Administratoren können Benutzer löschen" };
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Refresh users list
      fetchUsers();
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // Admin: Update user function
  const updateUser = async (userId: string, updates: { username?: string; password?: string; email?: string }) => {
    if (!user?.isAdmin) {
      return { success: false, error: "Nur Administratoren können Benutzer aktualisieren" };
    }

    try {
      let updateData: any = {};
      
      if (updates.email) {
        updateData.email = updates.email;
      }
      
      if (updates.password) {
        updateData.password = updates.password;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          userId,
          updateData
        );

        if (authError) {
          return { success: false, error: authError.message };
        }
      }

      if (updates.username) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username: updates.username })
          .eq('id', userId);

        if (profileError) {
          return { success: false, error: profileError.message };
        }
      }

      // Refresh users list
      fetchUsers();
      
      return { success: true };
    } catch (error: any) {
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
