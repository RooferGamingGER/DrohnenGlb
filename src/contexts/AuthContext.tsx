
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

export interface User {
  id: string;
  email: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // Firebase Auth Status überwachen
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const isAdmin = await checkIfUserIsAdmin(firebaseUser.uid);
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          isAdmin
        });
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Benutzerliste aktualisieren
    const loadUsers = async () => {
      const usersList = await getAllUsers();
      setUsers(usersList as User[]);
    };

    if (user?.isAdmin) {
      loadUsers();
    }
  }, [user]);

  const checkIfUserIsAdmin = async (uid: string): Promise<boolean> => {
    const usersList = await getAllUsers();
    const userInfo = usersList.find(u => u.id === uid);
    return userInfo?.isAdmin || false;
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
    if (!user?.isAdmin) return false;
    const firebaseUser = await createUserInFirebase(email, password, isAdmin);
    if (firebaseUser) {
      const updatedUsers = await getAllUsers();
      setUsers(updatedUsers as User[]);
    }
    return !!firebaseUser;
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    if (!user?.isAdmin) return false;
    const success = await deleteUserFromFirebase(userId);
    if (success) {
      const updatedUsers = await getAllUsers();
      setUsers(updatedUsers as User[]);
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
      setUsers(updatedUsers as User[]);
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
