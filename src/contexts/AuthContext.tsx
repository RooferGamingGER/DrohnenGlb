
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  getUsers, 
  findUserByUsername, 
  createUser as createMongoUser, 
  updateUser as updateMongoUser, 
  deleteUser as deleteMongoUser,
  initDatabase
} from '../services/mongoDBService';

// Benutzertyp-Definition
export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

// AuthContext Typdefinition
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, password: string) => Promise<boolean>;
  createUser: (username: string, password: string, isAdmin: boolean) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  updateUser: (userId: string, updates: { username?: string; password?: string }) => Promise<boolean>;
  users: Array<{ id: string; username: string; isAdmin?: boolean }>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Auth-Kontext erstellen
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialisierung: Benutzer laden und Datenbank initialisieren
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        // Datenbank initialisieren (erstellt Admin, falls keine Benutzer existieren)
        await initDatabase();
        
        // Aktuell eingeloggten Benutzer aus dem localStorage laden
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        
        // Alle Benutzer laden
        await loadUsers();
      } catch (error) {
        console.error("Fehler bei der Initialisierung:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, []);

  // Benutzer laden
  const loadUsers = async () => {
    try {
      const usersList = await getUsers();
      // Entferne Passwörter aus der Benutzerliste
      const usersWithoutPasswords = usersList.map(({ password, ...rest }: any) => rest);
      setUsers(usersWithoutPasswords);
    } catch (error) {
      console.error("Fehler beim Laden der Benutzer:", error);
    }
  };

  // Login-Funktion
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const foundUser = await findUserByUsername(username);
      
      if (foundUser && foundUser.password === password) {
        // Passwort aus dem User-Objekt entfernen bevor es gespeichert wird
        const { password, ...userWithoutPassword } = foundUser;
        setUser(userWithoutPassword);
        localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        await loadUsers(); // Benutzerliste aktualisieren
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login-Fehler:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout-Funktion
  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  // Registrierungsfunktion
  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      // Prüfen, ob Benutzername bereits existiert
      const existingUser = await findUserByUsername(username);
      if (existingUser) {
        return false;
      }
      
      // Neuen Benutzer erstellen
      const success = await createMongoUser({
        username,
        password,
        isAdmin: false,
      });
      
      if (success) {
        await loadUsers(); // Benutzerliste aktualisieren
      }
      
      return success;
    } catch (error) {
      console.error("Registrierungsfehler:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin kann Benutzer erstellen
  const createUser = async (username: string, password: string, isAdmin: boolean): Promise<boolean> => {
    try {
      setIsLoading(true);
      // Prüfen, ob der aktuelle Benutzer Admin-Rechte hat
      if (!user?.isAdmin) {
        return false;
      }
      
      // Prüfen, ob Benutzername bereits existiert
      const existingUser = await findUserByUsername(username);
      if (existingUser) {
        return false;
      }
      
      // Neuen Benutzer erstellen
      const success = await createMongoUser({
        username,
        password,
        isAdmin,
      });
      
      if (success) {
        await loadUsers(); // Benutzerliste aktualisieren
      }
      
      return success;
    } catch (error) {
      console.error("Fehler beim Erstellen des Benutzers:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Benutzer aktualisieren
  const updateUser = async (
    userId: string,
    updates: { username?: string; password?: string }
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      // Prüfen, ob der aktuelle Benutzer Admin-Rechte hat
      if (!user?.isAdmin) {
        return false;
      }
      
      const success = await updateMongoUser(userId, updates);
      
      if (success) {
        // Wenn der aktuell eingeloggte Benutzer aktualisiert wurde, aktualisiere auch den lokalen Zustand
        if (user && user.id === userId && updates.username) {
          const updatedUser = { ...user, username: updates.username };
          setUser(updatedUser);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        }
        
        await loadUsers(); // Benutzerliste aktualisieren
      }
      
      return success;
    } catch (error) {
      console.error("Fehler beim Aktualisieren des Benutzers:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Admin kann Benutzer löschen
  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      // Prüfen, ob der aktuelle Benutzer Admin-Rechte hat
      if (!user?.isAdmin) {
        return false;
      }
      
      const success = await deleteMongoUser(userId);
      
      if (success) {
        await loadUsers(); // Benutzerliste aktualisieren
      }
      
      return success;
    } catch (error) {
      console.error("Fehler beim Löschen des Benutzers:", error);
      return false;
    } finally {
      setIsLoading(false);
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
