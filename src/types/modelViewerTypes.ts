
import * as THREE from 'three';

export interface ModelViewerState {
  isLoading: boolean;
  progress: number;
  error: string | null;
  loadedModel: THREE.Group | null;
}

export interface UseModelViewerProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export interface ModelSceneRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: any; // OrbitControls type
  lights: {
    directional: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
  } | null;
  requestId: number | null;
  model: THREE.Group | null;
}

export interface ProcessingState {
  processingStartTime: number | null;
  uploadProgress: number;
  processingInterval: number | null;
}
