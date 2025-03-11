import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  auth,
  loginWithFirebase, 
  logoutFromFirebase,
  createUserInFirebase,
  deleteUserFromFirebase,
  updateUserInFirebase,
  getAllUsers,
  checkIfInitialAdminNeeded
} from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
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

  const checkIfUserIsAdmin = useCallback(async (uid: string): Promise<boolean> => {
    try {
      const usersList = await getAllUsers();
      const userInfo = usersList.find((u: FirestoreUser) => u.uid === uid || u.id === uid) as FirestoreUser | undefined;
      return userInfo?.isAdmin || false;
    } catch (error) {
      console.error("Fehler beim Prüfen des Admin-Status:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const isAdmin = await checkIfUserIsAdmin(firebaseUser.uid);
        const userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          username: firebaseUser.email || '',
          isAdmin: isAdmin
        };
        setUser(userData);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [checkIfUserIsAdmin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const firebaseUser = await loginWithFirebase(email, password);
      
      if (firebaseUser) {
        const isAdmin = await checkIfUserIsAdmin(firebaseUser.user.uid);
        setUser({
          id: firebaseUser.user.uid,
          email: firebaseUser.user.email || '',
          username: firebaseUser.user.email || '',
          isAdmin: isAdmin
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login error in AuthContext:", error);
      return false;
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
        isAdmin: user.isAdmin || false
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

  useEffect(() => {
    const checkForInitialAdmin = async () => {
      try {
        const needsAdmin = await checkIfInitialAdminNeeded();
        setNeedsInitialAdmin(needsAdmin);
      } catch (error) {
        console.error("Fehler bei der Prüfung auf initialen Admin:", error);
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
          const formattedUsers: User[] = usersList.map((user: FirestoreUser) => ({
            id: user.uid || user.id,
            email: user.email || '',
            username: user.email || '',
            isAdmin: user.isAdmin || false
          }));
          setUsers(formattedUsers);
        } catch (error) {
          console.error("Fehler beim Laden der Benutzer:", error);
        }
      };

      loadUsers();
    }
  }, [user]);

  const setupInitialAdmin = async (email: string, password: string): Promise<boolean> => {
    try {
      const needsAdmin = await checkIfInitialAdminNeeded();
      if (!needsAdmin) {
        toast({
          title: "Fehler",
          description: "Es existieren bereits Benutzer. Der initiale Admin kann nicht erstellt werden.",
          variant: "destructive",
        });
        return false;
      }
      
      const userCredential = await createUserInFirebase(email, password, true);
      
      if (userCredential) {
        toast({
          title: "Erfolg",
          description: "Admin-Benutzer wurde erfolgreich erstellt. Sie können sich jetzt anmelden.",
        });
        setNeedsInitialAdmin(false);
        return true;
      } else {
        toast({
          title: "Fehler",
          description: "Admin-Benutzer konnte nicht erstellt werden. Bitte überprüfen Sie die Firebase-Konfiguration.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Fehler bei der Einrichtung des Admin-Benutzers:", error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
        variant: "destructive",
      });
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
