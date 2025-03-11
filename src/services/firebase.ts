import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  Auth,
  UserCredential
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.error('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.error('The current browser does not support persistence.');
    }
  });

// Firebase Auth Funktionen
export const loginWithFirebase = async (email: string, password: string): Promise<UserCredential | null> => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login Fehler:", error);
    throw error;
  }
};

export const logoutFromFirebase = async (): Promise<boolean> => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Logout Fehler:", error);
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

export const getAllUsers = async () => {
  try {
    const usersCollection = collection(db, "users");
    const q = query(usersCollection);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error("Fehler beim Abrufen der Benutzer:", error);
    return [];
  }
};

export const checkIfInitialAdminNeeded = async (): Promise<boolean> => {
  try {
    const usersCollection = collection(db, "users");
    const querySnapshot = await getDocs(usersCollection);
    return querySnapshot.empty;
  } catch (error) {
    console.error("Fehler beim Prüfen des initialen Admin-Status:", error);
    return true;
  }
};
