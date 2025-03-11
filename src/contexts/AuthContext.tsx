import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth,
  loginWithFirebase, 
  logoutFromFirebase,
  createUserInFirebase,
  deleteUserFromFirebase,
  updateUserInFirebase,
  getAllUsers
} from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export interface User {
  id: string;
  email: string;
  username?: string;
  isAdmin?: boolean;
}

interface FirestoreUser {
  id: string;
  uid?: string;
  email?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  createUser: (email: string, password: string, isAdmin: boolean) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  updateUser: (userId: string, updates: { email?: string; password?: string }) => Promise<boolean>;
  users: User[];
  isAuthenticated: boolean;
  setupInitialAdmin: (email: string, password: string) => Promise<boolean>;
  needsInitialAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const isAdmin = await checkIfUserIsAdmin(firebaseUser.uid);
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            username: firebaseUser.email || '',
            isAdmin
          });
          console.log(`User authenticated: ${firebaseUser.uid}, isAdmin: ${isAdmin}`);
        } catch (error) {
          console.error("Error setting user data:", error);
          setUser(null);
        }
      } else {
        console.log("No authenticated user");
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkForInitialAdmin = async () => {
      try {
        const usersList = await getAllUsers();
        console.log("Checking for initial admin. Users count:", usersList.length);
        setNeedsInitialAdmin(usersList.length === 0);
      } catch (error) {
        console.error("Error checking for initial admin:", error);
        setNeedsInitialAdmin(true);
      }
    };

    checkForInitialAdmin();
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      const loadUsers = async () => {
        try {
          const usersList = await getAllUsers();
          const formattedUsers = usersList.map((user: FirestoreUser) => ({
            id: user.uid || user.id,
            email: user.email || '',
            username: user.email || '',
            isAdmin: !!user.isAdmin
          }));
          setUsers(formattedUsers);
          console.log("Users loaded:", formattedUsers.length);
        } catch (error) {
          console.error("Error loading users:", error);
        }
      };

      loadUsers();
    }
  }, [user]);

  const checkIfUserIsAdmin = async (uid: string): Promise<boolean> => {
    try {
      const usersList = await getAllUsers();
      const userInfo = usersList.find((u: FirestoreUser) => (u.uid || u.id) === uid) as FirestoreUser | undefined;
      return userInfo?.isAdmin === true;
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  };

  const setupInitialAdmin = async (email: string, password: string): Promise<boolean> => {
    const usersList = await getAllUsers();
    if (usersList.length > 0) {
      toast({
        title: "Fehler",
        description: "Es existieren bereits Benutzer. Der initiale Admin kann nicht erstellt werden.",
        variant: "destructive",
      });
      return false;
    }

    const firebaseUser = await createUserInFirebase(email, password, true);
    if (firebaseUser) {
      toast({
        title: "Erfolg",
        description: "Admin-Benutzer wurde erfolgreich erstellt. Sie können sich jetzt anmelden.",
      });
      setNeedsInitialAdmin(false);
      return true;
    }
    
    return false;
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const firebaseUser = await loginWithFirebase(email, password);
    return !!firebaseUser;
  };

  const logout = async (): Promise<boolean> => {
    const success = await logoutFromFirebase();
    if (success) {
      setUser(null);
    }
    return success;
  };

  const register = async (email: string, password: string): Promise<boolean> => {
    const firebaseUser = await createUserInFirebase(email, password, false);
    return !!firebaseUser;
  };

  const createUser = async (email: string, password: string, isAdmin: boolean): Promise<boolean> => {
    if (!user?.isAdmin) {
      toast({
        title: "Keine Berechtigung",
        description: "Sie benötigen Admin-Rechte, um Benutzer zu erstellen.",
        variant: "destructive",
      });
      return false;
    }
    
    const firebaseUser = await createUserInFirebase(email, password, isAdmin);
    
    if (firebaseUser) {
      toast({
        title: "Erfolg",
        description: `Benutzer ${email} wurde erfolgreich erstellt.`,
      });
      
      const updatedUsers = await getAllUsers();
      const formattedUsers = updatedUsers.map((user: FirestoreUser) => ({
        id: user.uid || user.id,
        email: user.email || '',
        username: user.email || '',
        isAdmin: !!user.isAdmin
      }));
      setUsers(formattedUsers);
      return true;
    } else {
      toast({
        title: "Fehler",
        description: "Der Benutzer konnte nicht erstellt werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    if (!user?.isAdmin) return false;
    const success = await deleteUserFromFirebase(userId);
    if (success) {
      const updatedUsers = await getAllUsers();
      const formattedUsers = updatedUsers.map((user: FirestoreUser) => ({
        id: user.uid || user.id,
        email: user.email || '',
        username: user.email || '',
        isAdmin: user.isAdmin || false
      }));
      setUsers(formattedUsers);
    }
    return success;
  };

  const updateUser = async (
    userId: string, 
    updates: { email?: string; password?: string }
  ): Promise<boolean> => {
    if (!user?.isAdmin) return false;
    const success = await updateUserInFirebase(userId, updates);
    if (success && updates.email) {
      const updatedUsers = await getAllUsers();
      const formattedUsers = updatedUsers.map((user: FirestoreUser) => ({
        id: user.uid || user.id,
        email: user.email || '',
        username: user.email || '',
        isAdmin: user.isAdmin || false
      }));
      setUsers(formattedUsers);
    }
    return success;
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
        setupInitialAdmin,
        needsInitialAdmin,
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
