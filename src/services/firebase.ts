
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
  Firestore
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

console.log("Firebase initialization starting...");
const initStartTime = performance.now();

// Initialize Firebase with optimized configuration
const app = initializeApp(firebaseConfig);
console.log(`Firebase app initialized in ${performance.now() - initStartTime}ms`);

// Auth with local persistence for faster access
const authStartTime = performance.now();
export const auth: Auth = getAuth(app);
console.log(`Auth service initialized in ${performance.now() - authStartTime}ms`);

const persistenceStartTime = performance.now();
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log(`Auth persistence set in ${performance.now() - persistenceStartTime}ms`);
  })
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

// Initialize Firestore
const dbStartTime = performance.now();
export const db: Firestore = getFirestore(app);
console.log(`Firestore initialized in ${performance.now() - dbStartTime}ms`);

// Enable offline persistence
const persistenceDbStartTime = performance.now();
enableIndexedDbPersistence(db)
  .then(() => {
    console.log(`Firestore persistence enabled in ${performance.now() - persistenceDbStartTime}ms`);
  })
  .catch((err) => {
    console.error("Firestore persistence error:", err);
  });

console.log(`Total Firebase initialization time: ${performance.now() - initStartTime}ms`);

// Optimierter Login mit Performance-Messung
export const loginWithFirebase = async (email: string, password: string): Promise<UserCredential | null> => {
  const startTime = performance.now();
  console.log("loginWithFirebase started");
  
  try {
    const authResult = await signInWithEmailAndPassword(auth, email, password);
    const endTime = performance.now();
    console.log(`Firebase auth completed in ${endTime - startTime}ms`);
    return authResult;
  } catch (error) {
    const errorTime = performance.now();
    console.error(`Login error after ${errorTime - startTime}ms:`, error);
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
