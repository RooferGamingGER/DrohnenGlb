
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

export type BackgroundOption = {
  id: string;
  name: string;
  color: string | null;
  texture: string | null;
};

export const backgroundOptions: BackgroundOption[] = [
  { id: 'neutral', name: 'Hell', color: '#f5f5f7', texture: null },
  { id: 'dark', name: 'Dunkel', color: '#1d1d1f', texture: null },
  { id: 'gray', name: 'Grau', color: '#404040', texture: null },
];

// Load GLB model
export const loadGLBModel = (
  file: File,
  onProgress?: (event: ProgressEvent) => void
): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    
    // Add DRACO loader support
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dracoLoader);
    
    const fileURL = URL.createObjectURL(file);

    loader.load(
      fileURL,
      (gltf) => {
        URL.revokeObjectURL(fileURL);
        resolve(gltf.scene);
      },
      (xhr) => {
        if (onProgress && xhr.lengthComputable) {
          onProgress(xhr);
        }
      },
      (error) => {
        URL.revokeObjectURL(fileURL);
        reject(error);
      }
    );
  });
};

// Center model and adjust camera
export const centerModel = (model: THREE.Object3D): THREE.Box3 => {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  
  model.position.x = -center.x;
  model.position.y = -center.y;
  model.position.z = -center.z;
  
  return box;
};

// Create a texture loader
export const loadTexture = (url: string): Promise<THREE.Texture> => {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        resolve(texture);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
};

// Format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// File validation
export const validateFile = (file: File): boolean => {
  // Check file type
  if (!file.name.toLowerCase().endsWith('.glb')) {
    return false;
  }
  
  // Max file size (100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return false;
  }
  
  return true;
};
