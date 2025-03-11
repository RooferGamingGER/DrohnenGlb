import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  Auth,
  UserCredential,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  deleteDoc,
  updateDoc,
  enableIndexedDbPersistence,
  Firestore,
  initializeFirestore,
  memoryLocalCache 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCeEwGPEtfBM23t4OVQGrD9MTF6TjRi1u0",
  authDomain: "dronenglb.firebaseapp.com",
  projectId: "dronenglb",
  storageBucket: "dronenglb.appspot.com",
  messagingSenderId: "896131806649",
  appId: "1:896131806649:web:a9def7530a4ddd975ab268",
  measurementId: "G-NVMJMDXDLK"
};

// Initialize Firebase with optimized configuration
const app = initializeApp(firebaseConfig);

// Auth with local persistence for faster access
export const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

// Fix the Firestore initialization - remove the conflicting cacheSizeBytes
export const db: Firestore = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.error("Firestore persistence error:", err);
});

// Optimierter Login
export const loginWithFirebase = async (email: string, password: string): Promise<UserCredential | null> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logoutFromFirebase = async (): Promise<boolean> => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

export const createUserInFirebase = async (
  email: string, 
  password: string, 
  isAdmin: boolean
): Promise<UserCredential | null> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Erstelle Firestore-Dokument für den Benutzer
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      isAdmin,
      uid: userCredential.user.uid,
      createdAt: new Date().toISOString()
    });

    console.log("Benutzer erfolgreich erstellt:", userCredential.user.uid);
    return userCredential;
  } catch (error: any) {
    console.error("Fehler beim Erstellen des Benutzers:", error);
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Diese E-Mail-Adresse wird bereits verwendet.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Ungültige E-Mail-Adresse.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('E-Mail/Passwort Anmeldung ist nicht aktiviert. Bitte überprüfen Sie die Firebase Console.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Das Passwort ist zu schwach.');
    }
    throw error;
  }
};

export const deleteUserFromFirebase = async (userId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, "users", userId));
    return true;
  } catch (error) {
    console.error("Fehler beim Löschen des Benutzers:", error);
    return false;
  }
};

export const updateUserInFirebase = async (
  userId: string,
  updates: { email?: string; password?: string }
): Promise<boolean> => {
  try {
    const userRef = doc(db, "users", userId);
    if (updates.email) {
      await updateDoc(userRef, { email: updates.email });
    }
    return true;
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Benutzers:", error);
    return false;
  }
};

// Optimierte User-Abfrage mit Caching
let cachedUsers: any[] = [];
let lastFetchTime = 0;
const CACHE_EXPIRY = 60000; // 1 Minute Cache-Gültigkeit

export const getAllUsers = async () => {
  try {
    const now = Date.now();
    // Verwende Cache, wenn dieser noch gültig ist
    if (cachedUsers.length > 0 && now - lastFetchTime < CACHE_EXPIRY) {
      return cachedUsers;
    }
    
    const usersCollection = collection(db, "users");
    const q = query(usersCollection);
    const querySnapshot = await getDocs(q);
    cachedUsers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    lastFetchTime = now;
    return cachedUsers;
  } catch (error) {
    console.error("Fehler beim Abrufen der Benutzer:", error);
    return [];
  }
};

// Cache für Admin-Check Status
let adminNeededStatus: boolean | null = null;
let adminCheckTime = 0;

export const checkIfInitialAdminNeeded = async (): Promise<boolean> => {
  try {
    const now = Date.now();
    if (adminNeededStatus !== null && now - adminCheckTime < CACHE_EXPIRY) {
      return adminNeededStatus;
    }
    
    const usersCollection = collection(db, "users");
    const querySnapshot = await getDocs(usersCollection);
    adminNeededStatus = querySnapshot.empty;
    adminCheckTime = now;
    return adminNeededStatus;
  } catch (error) {
    console.error("Fehler beim Prüfen des initialen Admin-Status:", error);
    return true;
  }
};
