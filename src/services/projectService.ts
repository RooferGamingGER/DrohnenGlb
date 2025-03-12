
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query, 
  orderBy,
  where,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  Timestamp
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject 
} from "firebase/storage";
import { auth, db } from "./firebase";
import { Measurement } from "@/utils/measurementUtils";

// Define project interface
export interface Project {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  userId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  thumbnail?: string;
  measurements: Measurement[];
}

// Save a new project
export const saveProject = async (
  file: File, 
  measurements: Measurement[] = []
): Promise<Project | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    // Prepare clean measurements without 3D objects to avoid circular references
    const cleanMeasurements = measurements.map(m => ({
      ...m,
      labelObject: undefined,
      lineObjects: undefined,
      pointObjects: undefined,
      areaObject: undefined
    }));

    // Upload the file to Firebase Storage
    const storage = getStorage();
    const fileExtension = file.name.split('.').pop();
    const storageRef = ref(storage, `projects/${currentUser.uid}/${Date.now()}-${file.name}`);
    
    // Start upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    // Wait for upload to complete
    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Track progress if needed
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        () => {
          resolve();
        }
      );
    });
    
    // Get download URL after successful upload
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
    
    // Create project document in Firestore
    const projectRef = doc(collection(db, "projects"));
    const projectId = projectRef.id;
    
    const projectData: Project = {
      id: projectId,
      name: file.name.replace(`.${fileExtension}`, ''),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      userId: currentUser.uid,
      fileUrl: downloadURL,
      fileName: file.name,
      fileSize: file.size,
      measurements: cleanMeasurements,
    };
    
    await setDoc(projectRef, projectData);
    console.log("Project saved successfully:", projectId);
    
    return projectData;
  } catch (error) {
    console.error("Error saving project:", error);
    return null;
  }
};

// Get all projects for the current user
export const getUserProjects = async (): Promise<Project[]> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    const projectsCollection = collection(db, "projects");
    const q = query(
      projectsCollection, 
      where("userId", "==", currentUser.uid),
      orderBy("updatedAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Project);
  } catch (error) {
    console.error("Error getting user projects:", error);
    return [];
  }
};

// Get a specific project by ID
export const getProjectById = async (projectId: string): Promise<Project | null> => {
  try {
    const projectRef = doc(db, "projects", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (projectDoc.exists()) {
      return projectDoc.data() as Project;
    } else {
      console.log("No such project!");
      return null;
    }
  } catch (error) {
    console.error("Error getting project:", error);
    return null;
  }
};

// Update project measurements
export const updateProjectMeasurements = async (
  projectId: string, 
  measurements: Measurement[]
): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    // Clean measurements to remove 3D objects before storing
    const cleanMeasurements = measurements.map(m => ({
      ...m,
      labelObject: undefined,
      lineObjects: undefined,
      pointObjects: undefined,
      areaObject: undefined
    }));
    
    const projectRef = doc(db, "projects", projectId);
    await updateDoc(projectRef, {
      measurements: cleanMeasurements,
      updatedAt: serverTimestamp()
    });
    
    console.log("Measurements updated successfully");
    return true;
  } catch (error) {
    console.error("Error updating measurements:", error);
    return false;
  }
};

// Delete a project
export const deleteProject = async (projectId: string): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }
    
    // Get project data to get the file URL
    const projectRef = doc(db, "projects", projectId);
    const projectDoc = await getDoc(projectRef);
    
    if (!projectDoc.exists()) {
      throw new Error("Project not found");
    }
    
    const projectData = projectDoc.data() as Project;
    
    // Delete file from storage if it exists
    if (projectData.fileUrl) {
      const storage = getStorage();
      const fileRef = ref(storage, projectData.fileUrl);
      await deleteObject(fileRef);
    }
    
    // Delete project document
    await deleteDoc(projectRef);
    
    console.log("Project deleted successfully");
    return true;
  } catch (error) {
    console.error("Error deleting project:", error);
    return false;
  }
};
