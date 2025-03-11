
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
  setDoc
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const loginWithFirebase = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login successful:", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
};

export const logoutFromFirebase = async () => {
  try {
    await signOut(auth);
    console.log("Logout successful");
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

export const createUserInFirebase = async (email: string, password: string, isAdmin: boolean) => {
  try {
    console.log(`Creating user ${email} with isAdmin=${isAdmin}`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    // Store user information in Firestore using document ID as UID
    await setDoc(doc(db, 'users', uid), {
      uid: uid,
      email: email,
      isAdmin: isAdmin,
      createdAt: new Date().toISOString()
    });
    
    console.log("User created successfully:", uid);
    return userCredential.user;
  } catch (error) {
    console.error("Create user error:", error);
    return null;
  }
};

export const deleteUserFromFirebase = async (uid: string) => {
  try {
    // Delete user document from Firestore first
    await deleteDoc(doc(db, 'users', uid));
    console.log("User document deleted:", uid);
    
    // Then attempt to delete the auth user
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await firebaseDeleteUser(auth.currentUser);
      console.log("Auth user deleted:", uid);
    } else {
      console.warn("Cannot delete auth user - not currently signed in as that user");
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
    if (!auth.currentUser) {
      console.error("No authenticated user");
      return false;
    }

    // Update authentication email/password if provided
    if (updates.email) {
      await updateEmail(auth.currentUser, updates.email);
      console.log("Auth email updated");
      
      // Update email in Firestore
      await updateDoc(doc(db, 'users', uid), {
        email: updates.email
      });
      console.log("Firestore email updated");
    }

    if (updates.password) {
      await updatePassword(auth.currentUser, updates.password);
      console.log("Password updated");
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
    const users = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id,
        uid: data.uid || doc.id,
        email: data.email || '',
        isAdmin: data.isAdmin || false
      };
    });
    console.log("Retrieved users:", users.length);
    return users;
  } catch (error) {
    console.error("Get users error:", error);
    return [];
  }
};

export { auth, db };
