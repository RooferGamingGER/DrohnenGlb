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
  deleteUser: (userId: string) => boolean;
  updateUser: (userId: string, updates: { username?: string; password?: string; id?: string }) => boolean;
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
      
      // Prüfen ob der gespeicherte Benutzer noch in der Benutzerliste existiert
      const userStillExists = users.some(u => u.id === parsedUser.id);
      
      if (userStillExists) {
        setUser(parsedUser);
      } else {
        // Wenn Benutzer nicht mehr existiert, aus dem localStorage entfernen
        localStorage.removeItem('currentUser');
      }
    }
  }, [users]);

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

  // Neue Funktion: Benutzer aktualisieren
  const updateUser = (
    userId: string,
    updates: { username?: string; password?: string; id?: string }
  ): boolean => {
    // Prüfen, ob der aktuelle Benutzer Admin-Rechte hat
    if (!user?.isAdmin) {
      return false;
    }

    setUsers(currentUsers => {
      const updatedUsers = currentUsers.map(u => {
        if (u.id === userId) {
          // Aktualisiere den Benutzer mit den neuen Werten
          const updatedUser = { ...u };
          if (updates.username) updatedUser.username = updates.username;
          if (updates.password) updatedUser.password = updates.password;
          if (updates.id) updatedUser.id = updates.id;
          return updatedUser;
        }
        return u;
      });

      // Wenn der aktuell eingeloggte Benutzer aktualisiert wurde, aktualisiere auch den lokalen Zustand
      if (user && user.id === userId) {
        const updatedUser = updatedUsers.find(u => u.id === userId);
        if (updatedUser) {
          const { password, ...userWithoutPassword } = updatedUser;
          setUser(userWithoutPassword);
          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        }
      }

      return updatedUsers;
    });

    return true;
  };

  // Neue Funktion: Admin kann Benutzer löschen
  const deleteUser = (userId: string): boolean => {
    // Prüfen, ob der aktuelle Benutzer Admin-Rechte hat
    if (!user?.isAdmin) {
      return false;
    }
    
    // Prüfen, ob der zu löschende Benutzer existiert
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) {
      return false;
    }
    
    // Benutzer aus der Liste entfernen
    setUsers(users.filter(u => u.id !== userId));
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
        deleteUser,
        updateUser,
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
