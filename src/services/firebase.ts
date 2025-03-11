import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  Auth,
  UserCredential,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence
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

console.log("Firebase initialization starting with optimized settings...");
const initStartTime = performance.now();

// Initialize Firebase with optimized configuration
const app = initializeApp(firebaseConfig);
console.log(`Firebase app initialized in ${performance.now() - initStartTime}ms`);

// Auth with efficient persistence
const authStartTime = performance.now();
export const auth: Auth = getAuth(app);
console.log(`Auth service initialized in ${performance.now() - authStartTime}ms`);

// Use local persistence for better performance when remembering user
const persistenceStartTime = performance.now();
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log(`Auth persistence set in ${performance.now() - persistenceStartTime}ms`);
  })
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

// Initialize Firestore with optimized settings
const dbStartTime = performance.now();
export const db: Firestore = getFirestore(app);
console.log(`Firestore initialized in ${performance.now() - dbStartTime}ms`);

// Enable offline persistence with optimized settings
const persistenceDbStartTime = performance.now();
enableIndexedDbPersistence(db, {
  synchronizeTabs: false // Disable multi-tab synchronization for better performance
})
  .then(() => {
    console.log(`Firestore persistence enabled in ${performance.now() - persistenceDbStartTime}ms`);
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn("Firestore persistence unavailable - multiple tabs detected");
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required for persistence
      console.warn("Firestore persistence not supported in this browser");
    } else {
      console.error("Firestore persistence error:", err);
    }
  });

console.log(`Total Firebase initialization time: ${performance.now() - initStartTime}ms`);

// Optimized login with better error handling and performance tracking
export const loginWithFirebase = async (email: string, password: string): Promise<UserCredential | null> => {
  const startTime = performance.now();
  console.log("Firebase Login Start", startTime);
  
  try {
    // Use a timeout to prevent hanging requests
    const authResult = await Promise.race([
      signInWithEmailAndPassword(auth, email, password),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Login Timeout nach 8 Sekunden")), 8000)
      )
    ]) as UserCredential;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Firebase Login erfolgreich in ${duration.toFixed(2)}ms`);
    
    // Report slow logins for debugging
    if (duration > 2000) {
      console.warn(`Langsames Login detektiert: ${duration.toFixed(2)}ms`);
    }
    
    return authResult;
  } catch (error: any) {
    const errorTime = performance.now();
    const duration = errorTime - startTime;
    
    if (error.message === "Login Timeout nach 8 Sekunden") {
      console.error(`Login Timeout nach ${duration.toFixed(2)}ms - Server antwortet nicht`);
      throw new Error("Die Anmeldung dauert zu lange. Bitte versuchen Sie es später erneut.");
    }
    
    // Provide more helpful error messages
    if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
      console.warn(`Login fehlgeschlagen (${error.code}) nach ${duration.toFixed(2)}ms`);
      throw new Error("E-Mail oder Passwort falsch");
    } else if (error.code === 'auth/too-many-requests') {
      console.error(`Login blockiert (${error.code}) nach ${duration.toFixed(2)}ms`);
      throw new Error("Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.");
    } else if (error.code === 'auth/network-request-failed') {
      console.error(`Netzwerkfehler (${error.code}) nach ${duration.toFixed(2)}ms`);
      throw new Error("Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.");
    }
    
    console.error(`Login Fehler (${error.code || 'unbekannt'}) nach ${duration.toFixed(2)}ms:`, error);
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
