
import axios from 'axios';

// MongoDB Atlas Data API Endpunkt
// WICHTIG: Ersetzen Sie diese URL mit Ihrer eigenen MongoDB Data API URL
const API_URL = "https://eu-central-1.aws.data.mongodb-api.com/app/data-abcde/endpoint/data/v1/action";
// WICHTIG: Ersetzen Sie diesen API-Key mit Ihrem eigenen API-Key
const API_KEY = "YOUR_API_KEY"; 
// Datenbank- und Collection-Namen
const DB_NAME = "authDB";
const USERS_COLLECTION = "users";

// Konfiguration für HTTP-Anfragen
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Request-Headers': '*',
  'api-key': API_KEY,
};

// Benutzer abrufen
export const getUsers = async () => {
  try {
    const response = await axios.post(
      `${API_URL}/find`,
      {
        dataSource: "Cluster0",
        database: DB_NAME,
        collection: USERS_COLLECTION,
        filter: {},
      },
      { headers }
    );
    return response.data.documents || [];
  } catch (error) {
    console.error("Fehler beim Abrufen der Benutzer:", error);
    return [];
  }
};

// Benutzer anhand des Benutzernamens suchen
export const findUserByUsername = async (username: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/find`,
      {
        dataSource: "Cluster0",
        database: DB_NAME,
        collection: USERS_COLLECTION,
        filter: { username },
      },
      { headers }
    );
    return response.data.documents?.[0] || null;
  } catch (error) {
    console.error("Fehler beim Suchen des Benutzers:", error);
    return null;
  }
};

// Benutzer erstellen
export const createUser = async (userData: { 
  username: string; 
  password: string; 
  isAdmin?: boolean;
}) => {
  try {
    const response = await axios.post(
      `${API_URL}/insertOne`,
      {
        dataSource: "Cluster0",
        database: DB_NAME,
        collection: USERS_COLLECTION,
        document: {
          ...userData,
          id: Date.now().toString(),
        },
      },
      { headers }
    );
    return response.data.insertedId ? true : false;
  } catch (error) {
    console.error("Fehler beim Erstellen des Benutzers:", error);
    return false;
  }
};

// Benutzer aktualisieren
export const updateUser = async (userId: string, updates: { 
  username?: string; 
  password?: string;
}) => {
  try {
    const response = await axios.post(
      `${API_URL}/updateOne`,
      {
        dataSource: "Cluster0",
        database: DB_NAME,
        collection: USERS_COLLECTION,
        filter: { id: userId },
        update: { $set: updates },
      },
      { headers }
    );
    return response.data.modifiedCount > 0;
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Benutzers:", error);
    return false;
  }
};

// Benutzer löschen
export const deleteUser = async (userId: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/deleteOne`,
      {
        dataSource: "Cluster0",
        database: DB_NAME,
        collection: USERS_COLLECTION,
        filter: { id: userId },
      },
      { headers }
    );
    return response.data.deletedCount > 0;
  } catch (error) {
    console.error("Fehler beim Löschen des Benutzers:", error);
    return false;
  }
};

// Datenbank initialisieren mit Admin-Benutzer, falls keine Benutzer existieren
export const initDatabase = async () => {
  try {
    const users = await getUsers();
    
    if (users.length === 0) {
      // Erstellen eines Standard-Admin-Benutzers, wenn die Datenbank leer ist
      await createUser({
        username: "admin",
        password: "admin123",
        isAdmin: true
      });
      console.log("Admin-Benutzer wurde erstellt");
    }
    return true;
  } catch (error) {
    console.error("Fehler bei der Initialisierung der Datenbank:", error);
    return false;
  }
};
