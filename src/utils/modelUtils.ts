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
  { id: 'neutral', name: 'Weiß', color: '#ffffff', texture: null },
  { id: 'dark', name: 'Dunkel', color: '#1d1d1f', texture: null },
  { id: 'gray', name: 'Grau', color: '#404040', texture: null },
];

export const extractCameraPositionFromModel = (box: THREE.Box3): THREE.Vector3 => {
  const size = new THREE.Vector3();
  box.getSize(size);
  
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = maxDimension * 1.8;
  
  return new THREE.Vector3(distance, distance * 0.8, distance);
};

export const calculateZoomFactor = (camera: THREE.Camera, target: THREE.Vector3, modelSize: number): number => {
  const cameraPosition = new THREE.Vector3().copy(camera.position);
  const distance = cameraPosition.distanceTo(target);
  
  const MIN_MOVEMENT_FACTOR = 0.2;
  
  const modelRadius = modelSize * 0.5;
  
  if (distance < modelRadius * 0.5) {
    return MIN_MOVEMENT_FACTOR;
  }
  
  const factor = Math.max(
    MIN_MOVEMENT_FACTOR,
    Math.min(1.0, distance / (modelRadius * 3))
  );
  
  return factor;
};

export const moveCameraWithRightDrag = (
  camera: THREE.Camera,
  controls: any,
  movementX: number,
  movementY: number,
  modelSize: number
): void => {
  if (!controls) return;
  
  const movementSpeed = calculateZoomFactor(camera, controls.target, modelSize) * 0.005 * modelSize;
  
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  
  const rightMovement = right.clone().multiplyScalar(-movementX * movementSpeed);
  const upMovement = up.clone().multiplyScalar(movementY * movementSpeed * 0.3);
  
  camera.position.add(rightMovement).add(upMovement);
  controls.target.add(rightMovement).add(upMovement);
  
  controls.update();
};

export const smoothZoomCamera = (
  camera: THREE.Camera,
  controls: any,
  zoomFactor: number,
  modelSize: number
): void => {
  if (!controls) return;
  
  const direction = new THREE.Vector3();
  direction.subVectors(camera.position, controls.target).normalize();
  
  const adaptiveZoom = calculateZoomFactor(camera, controls.target, modelSize) * zoomFactor * modelSize * 0.05;
  
  camera.position.addScaledVector(direction, adaptiveZoom);
  
  const minDistance = modelSize * 0.2;
  const currentDistance = camera.position.distanceTo(controls.target);
  
  if (currentDistance < minDistance) {
    camera.position.copy(
      controls.target.clone().add(direction.multiplyScalar(minDistance))
    );
  }
  
  controls.update();
};

export const loadGLBModel = (file: File): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    
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
      undefined,
      (error) => {
        URL.revokeObjectURL(fileURL);
        reject(error);
      }
    );
  });
};

export const centerModel = (model: THREE.Object3D): THREE.Box3 => {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  
  model.position.x = -center.x;
  model.position.y = -center.y;
  model.position.z = -center.z;
  
  model.updateMatrix();
  model.updateMatrixWorld(true);
  
  return box;
};

export const optimallyCenterModel = (
  model: THREE.Object3D, 
  camera: THREE.Camera, 
  controls: any
): void => {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = new THREE.Vector3();
  box.getSize(size);
  
  model.position.x = -center.x;
  model.position.y = -center.y;
  model.position.z = -center.z;
  
  const maxDimension = Math.max(size.x, size.y, size.z);
  const distance = maxDimension * 2.0;
  
  camera.position.set(distance, distance * 0.8, distance);
  
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
  
  model.updateMatrix();
  model.updateMatrixWorld(true);
  
  if (camera instanceof THREE.PerspectiveCamera) {
    const aspect = camera.aspect;
    const fov = camera.fov * (Math.PI / 180);
    
    const requiredDistance = (maxDimension / 2) / Math.tan(fov / 2);
    
    const newPosition = camera.position.clone().normalize().multiplyScalar(requiredDistance * 1.2);
    camera.position.copy(newPosition);
    
    if (controls) {
      controls.update();
    }
  }
};

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

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFile = (file: File): boolean => {
  if (!file.name.toLowerCase().endsWith('.glb')) {
    return false;
  }
  
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return false;
  }
  
  return true;
};
