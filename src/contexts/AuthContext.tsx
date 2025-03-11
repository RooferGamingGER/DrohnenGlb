
import React, { createContext, useContext, useState, useEffect } from 'react';

// Benutzertyp-Definition
export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

// AuthContext Typdefinition
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  register: (username: string, password: string) => boolean;
  createUser: (username: string, password: string, isAdmin: boolean) => boolean;
  users: Array<{ id: string; username: string; isAdmin?: boolean }>;
  isAuthenticated: boolean;
}

// Auth-Kontext erstellen
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock-Daten für Benutzer (in einer realen Anwendung würde dies in einer Datenbank gespeichert)
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
  const [users, setUsers] = useState<Array<{ id: string; username: string; password: string; isAdmin?: boolean }>>(
    () => {
      // Benutzer aus dem localStorage laden oder Standardbenutzer verwenden
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
      return storedUsers ? JSON.parse(storedUsers) : defaultUsers;
    }
  );

  // Benutzer beim Start aus dem localStorage laden
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    }
  }, []);

  // Benutzer im localStorage aktualisieren, wenn sich die Liste ändert
  useEffect(() => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  // Login-Funktion
  const login = (username: string, password: string): boolean => {
    const foundUser = users.find(
      (u) => u.username === username && u.password === password
    );

    if (foundUser) {
      // Passwort aus dem User-Objekt entfernen bevor es gespeichert wird
      const { password, ...userWithoutPassword } = foundUser;
      setUser(userWithoutPassword);
      localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
      return true;
    }
    return false;
  };

  // Logout-Funktion
  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  // Registrierungsfunktion
  const register = (username: string, password: string): boolean => {
    // Prüfen, ob Benutzername bereits existiert
    if (users.some((u) => u.username === username)) {
      return false;
    }

    // Neuen Benutzer erstellen
    const newUser = {
      id: Date.now().toString(),
      username,
      password,
      isAdmin: false,
    };

    setUsers([...users, newUser]);
    return true;
  };

  // Neue Funktion: Admin kann Benutzer erstellen
  const createUser = (username: string, password: string, isAdmin: boolean): boolean => {
    // Prüfen, ob der aktuelle Benutzer Admin-Rechte hat
    if (!user?.isAdmin) {
      return false;
    }

    // Prüfen, ob Benutzername bereits existiert
    if (users.some((u) => u.username === username)) {
      return false;
    }

    // Neuen Benutzer erstellen
    const newUser = {
      id: Date.now().toString(),
      username,
      password,
      isAdmin,
    };

    setUsers([...users, newUser]);
    return true;
  };
  
  // Erstelle eine Liste von Benutzern ohne Passwörter für die Admin-Anzeige
  const userList = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        createUser,
        users: userList,
        isAuthenticated: !!user,
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
