
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  deleteUser as firebaseDeleteUser,
  updateEmail,
  updatePassword,
  type User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  where,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  enableIndexedDbPersistence
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCeEwGPEtfBM23t4OVQGrD9MTF6TjRi1u0",
  authDomain: "dronenglb.firebaseapp.com",
  projectId: "dronenglb",
  storageBucket: "dronenglb.appspot.com",
  messagingSenderId: "896131806649",
  appId: "1:896131806649:web:a9def7530a4ddd975ab268",
  measurementId: "G-NVMJMDXDLK"
};

// Firebase-App initialisieren
const app = initializeApp(firebaseConfig);
// Auth und Firestore als Dienste abrufen
const auth = getAuth(app);
const db = getFirestore(app);

// Offline-Persistenz aktivieren
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Mehrere Tabs geöffnet, Persistenz kann nur in einem Tab aktiviert werden.");
    } else if (err.code === 'unimplemented') {
      console.warn("Der aktuelle Browser unterstützt keine Persistenz.");
    }
  });
} catch (error) {
  console.error("Fehler beim Einrichten der Offline-Persistenz:", error);
}

// Funktion zum Überprüfen, ob ein Dokument existiert
export const checkDocumentExists = async (collectionName: string, documentId: string) => {
  try {
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error(`Fehler beim Überprüfen des Dokuments ${documentId} in ${collectionName}:`, error);
    return false;
  }
};

export const loginWithFirebase = async (email: string, password: string) => {
  try {
    console.log(`Versuche Anmeldung mit E-Mail: ${email}`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Anmeldung erfolgreich:", userCredential.user.uid);
    return userCredential.user;
  } catch (error: any) {
    console.error("Anmeldefehler:", error.code, error.message);
    return null;
  }
};

export const logoutFromFirebase = async () => {
  try {
    await signOut(auth);
    console.log("Abmeldung erfolgreich");
    return true;
  } catch (error: any) {
    console.error("Abmeldefehler:", error.code, error.message);
    return false;
  }
};

export const createUserInFirebase = async (email: string, password: string, isAdmin: boolean) => {
  try {
    console.log(`Erstelle Benutzer ${email} mit isAdmin=${isAdmin}`);
    
    // Erstelle Benutzer in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    // Bereite Benutzerdaten für Firestore vor
    const userData = {
      uid: uid,
      email: email,
      isAdmin: isAdmin,
      createdAt: new Date().toISOString()
    };
    
    console.log("Benutzer erstellt in Auth, speichere in Firestore:", userData);
    
    // In Firestore speichern
    await setDoc(doc(db, 'users', uid), userData);
    
    console.log("Benutzer erfolgreich erstellt und in Firestore gespeichert:", uid);
    return userCredential.user;
  } catch (error: any) {
    console.error("Fehler beim Erstellen des Benutzers:", error.code, error.message);
    return null;
  }
};

export const deleteUserFromFirebase = async (uid: string) => {
  try {
    // Prüfen, ob das Dokument existiert, bevor wir es löschen
    const exists = await checkDocumentExists('users', uid);
    
    if (exists) {
      // Dokument aus Firestore löschen
      await deleteDoc(doc(db, 'users', uid));
      console.log("Benutzerdokument gelöscht:", uid);
    } else {
      console.warn("Benutzerdokument nicht gefunden für UID:", uid);
    }
    
    // Dann versuchen, den Auth-Benutzer zu löschen
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await firebaseDeleteUser(auth.currentUser);
      console.log("Auth-Benutzer gelöscht:", uid);
    } else {
      console.warn("Auth-Benutzer kann nicht gelöscht werden - nicht als dieser Benutzer angemeldet");
    }
    
    return true;
  } catch (error: any) {
    console.error("Fehler beim Löschen des Benutzers:", error.code, error.message);
    return false;
  }
};

export const updateUserInFirebase = async (
  uid: string, 
  updates: { email?: string; password?: string }
) => {
  try {
    if (!auth.currentUser) {
      console.error("Kein authentifizierter Benutzer");
      return false;
    }

    // Auth-E-Mail/Passwort aktualisieren, falls angegeben
    if (updates.email) {
      await updateEmail(auth.currentUser, updates.email);
      console.log("Auth-E-Mail aktualisiert");
      
      // E-Mail in Firestore aktualisieren
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        email: updates.email
      });
      console.log("Firestore-E-Mail aktualisiert");
    }

    if (updates.password) {
      await updatePassword(auth.currentUser, updates.password);
      console.log("Passwort aktualisiert");
    }

    return true;
  } catch (error: any) {
    console.error("Fehler beim Aktualisieren des Benutzers:", error.code, error.message);
    return false;
  }
};

export const getAllUsers = async () => {
  try {
    console.log("Rufe alle Benutzer aus Firestore ab...");
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    if (querySnapshot.empty) {
      console.log("Keine Benutzer in der Datenbank gefunden.");
      return [];
    }
    
    const users = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id,
        uid: data.uid || doc.id,
        email: data.email || '',
        isAdmin: data.isAdmin === true // Explizit als Boolean
      };
    });
    
    console.log("Benutzer abgerufen:", users.length, users);
    return users;
  } catch (error: any) {
    console.error("Fehler beim Abrufen der Benutzer:", error.code, error.message);
    return [];
  }
};

// Prüfen, ob ein initialer Admin benötigt wird
export const checkIfInitialAdminNeeded = async () => {
  try {
    console.log("Prüfe, ob ein initialer Admin benötigt wird...");
    const users = await getAllUsers();
    console.log("Anzahl der vorhandenen Benutzer:", users.length);
    return users.length === 0;
  } catch (error) {
    console.error("Fehler beim Prüfen des initialen Admins:", error);
    return true; // Im Fehlerfall davon ausgehen, dass ein Admin benötigt wird
  }
};

export { auth, db };
