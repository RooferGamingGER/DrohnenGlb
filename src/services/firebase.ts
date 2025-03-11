
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
  updateDoc
} from 'firebase/firestore';

const firebaseConfig = {
  // Hier müssen Sie Ihre Firebase-Konfiguration einfügen
  apiKey: "IHRE_API_KEY",
  authDomain: "IHRE_AUTH_DOMAIN",
  projectId: "IHRE_PROJECT_ID",
  storageBucket: "IHRE_STORAGE_BUCKET",
  messagingSenderId: "IHRE_MESSAGING_SENDER_ID",
  appId: "IHRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const loginWithFirebase = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
};

export const logoutFromFirebase = async () => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

export const createUserInFirebase = async (email: string, password: string, isAdmin: boolean) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Benutzerinformationen in Firestore speichern
    await addDoc(collection(db, 'users'), {
      uid: userCredential.user.uid,
      email: email,
      isAdmin: isAdmin
    });
    
    return userCredential.user;
  } catch (error) {
    console.error("Create user error:", error);
    return null;
  }
};

export const deleteUserFromFirebase = async (uid: string) => {
  try {
    // Benutzer aus Firestore löschen
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    
    querySnapshot.forEach(async (document) => {
      await deleteDoc(doc(db, 'users', document.id));
    });

    // Benutzer aus Firebase Auth löschen
    if (auth.currentUser) {
      await firebaseDeleteUser(auth.currentUser);
    }
    
    return true;
  } catch (error) {
    console.error("Delete user error:", error);
    return false;
  }
};

export const updateUserInFirebase = async (
  uid: string, 
  updates: { email?: string; password?: string }
) => {
  try {
    if (!auth.currentUser) return false;

    if (updates.email) {
      await updateEmail(auth.currentUser, updates.email);
      
      // Email in Firestore aktualisieren
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      
      querySnapshot.forEach(async (document) => {
        await updateDoc(doc(db, 'users', document.id), {
          email: updates.email
        });
      });
    }

    if (updates.password) {
      await updatePassword(auth.currentUser, updates.password);
    }

    return true;
  } catch (error) {
    console.error("Update user error:", error);
    return false;
  }
};

export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    return querySnapshot.docs.map(doc => ({ id: doc.data().uid, ...doc.data() }));
  } catch (error) {
    console.error("Get users error:", error);
    return [];
  }
};

export { auth, db };
