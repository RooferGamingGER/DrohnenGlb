
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ModelSceneRefs } from '@/types/modelViewerTypes';

export const initializeScene = (
  containerRef: React.RefObject<HTMLDivElement>,
  sceneRefs: ModelSceneRefs
): void => {
  if (!containerRef.current) return;

  // Create scene
  const scene = new THREE.Scene();
  sceneRefs.scene = scene;

  // Set up camera
  const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.z = 5;
  sceneRefs.camera = camera;

  // Set up renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMappingExposure = 1;
  containerRef.current.appendChild(renderer.domElement);
  sceneRefs.renderer = renderer;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  sceneRefs.lights = {
    directional: directionalLight,
    ambient: ambientLight
  };

  // Add controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.2;
  controls.panSpeed = 0.8;
  controls.update();
  sceneRefs.controls = controls;
};

export const setupAnimationLoop = (
  sceneRefs: ModelSceneRefs,
  animate: () => void
): void => {
  if (!sceneRefs.requestId) {
    sceneRefs.requestId = requestAnimationFrame(animate);
  }
};

export const cleanupScene = (
  containerRef: React.RefObject<HTMLDivElement>,
  sceneRefs: ModelSceneRefs
): void => {
  if (sceneRefs.requestId) {
    cancelAnimationFrame(sceneRefs.requestId);
    sceneRefs.requestId = null;
  }
  
  if (sceneRefs.renderer && containerRef.current) {
    containerRef.current.removeChild(sceneRefs.renderer.domElement);
  }
  
  if (sceneRefs.model && sceneRefs.scene) {
    sceneRefs.scene.remove(sceneRefs.model);
  }
  
  sceneRefs.renderer?.dispose();
};

export const handleResize = (
  containerRef: React.RefObject<HTMLDivElement>,
  sceneRefs: ModelSceneRefs
): void => {
  if (containerRef.current && sceneRefs.camera && sceneRefs.renderer) {
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    sceneRefs.camera.aspect = width / height;
    sceneRefs.camera.updateProjectionMatrix();

    sceneRefs.renderer.setSize(width, height);
  }
};
