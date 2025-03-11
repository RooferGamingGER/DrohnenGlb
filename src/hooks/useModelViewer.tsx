
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { loadGLBModel, centerModel, loadTexture, BackgroundOption } from '@/utils/modelUtils';

interface UseModelViewerProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

interface ModelViewerState {
  isLoading: boolean;
  progress: number;
  error: string | null;
  loadedModel: THREE.Group | null;
}

export const useModelViewer = ({ containerRef }: UseModelViewerProps) => {
  const [state, setState] = useState<ModelViewerState>({
    isLoading: false,
    progress: 0,
    error: null,
    loadedModel: null,
  });
  
  const [lightRotation, setLightRotation] = useState({ x: 0, y: 0 });
  const [lightIntensity, setLightIntensity] = useState(1);
  const [background, setBackground] = useState<BackgroundOption>(
    { id: 'neutral', name: 'Neutral', color: '#f5f5f7', texture: null }
  );

  // Three.js references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const lightsRef = useRef<{
    directional: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
  } | null>(null);
  const requestRef = useRef<number | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);

  // Initialize the scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup camera
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMappingExposure = 1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    lightsRef.current = {
      directional: directionalLight,
      ambient: ambientLight
    };

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.update();
    controlsRef.current = controls;

    // Render loop
    const animate = () => {
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);

    // Handle window resize
    const handleResize = () => {
      if (
        containerRef.current &&
        cameraRef.current &&
        rendererRef.current
      ) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();

        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    // Apply initial background
    applyBackground(background);

    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
      }
      
      rendererRef.current?.dispose();
    };
  }, []);

  // Handle model loading
  const loadModel = async (file: File) => {
    try {
      if (!sceneRef.current) return;

      // Clear previous model
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
      }

      setState({
        isLoading: true,
        progress: 0,
        error: null,
        loadedModel: null,
      });

      // Load model
      const model = await loadGLBModel(
        file,
        (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setState(prev => ({ ...prev, progress: percentComplete }));
          }
        }
      );

      // Center model
      const box = centerModel(model);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());

      // Adjust camera and controls
      if (cameraRef.current && controlsRef.current) {
        // Position camera based on model size
        const distance = size * 2;
        cameraRef.current.position.copy(center);
        cameraRef.current.position.z += distance;
        cameraRef.current.lookAt(center);

        // Update controls target
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
        controlsRef.current.saveState();
      }

      // Add model to scene
      sceneRef.current.add(model);
      modelRef.current = model;

      setState({
        isLoading: false,
        progress: 100,
        error: null,
        loadedModel: model,
      });

    } catch (error) {
      console.error('Error loading model:', error);
      setState({
        isLoading: false,
        progress: 0,
        error: 'Fehler beim Laden des Modells',
        loadedModel: null,
      });
    }
  };

  // Update light rotation
  useEffect(() => {
    if (lightsRef.current) {
      const { directional } = lightsRef.current;
      
      // Convert degrees to radians
      const radX = (lightRotation.x * Math.PI) / 180;
      const radY = (lightRotation.y * Math.PI) / 180;
      
      // Calculate new light position
      const distance = 5;
      directional.position.x = Math.sin(radY) * Math.cos(radX) * distance;
      directional.position.y = Math.sin(radX) * distance;
      directional.position.z = Math.cos(radY) * Math.cos(radX) * distance;
    }
  }, [lightRotation]);

  // Update light intensity
  useEffect(() => {
    if (lightsRef.current) {
      lightsRef.current.directional.intensity = lightIntensity;
    }
  }, [lightIntensity]);

  // Apply background
  const applyBackground = async (option: BackgroundOption) => {
    if (!sceneRef.current || !rendererRef.current) return;

    // Remove previous background if any
    if (sceneRef.current.background) {
      if (sceneRef.current.background instanceof THREE.Texture) {
        sceneRef.current.background.dispose();
      }
      sceneRef.current.background = null;
    }

    // Set renderer alpha
    rendererRef.current.setClearAlpha(option.id === 'transparent' ? 0 : 1);

    // Apply new background
    if (option.color) {
      sceneRef.current.background = new THREE.Color(option.color);
    } else if (option.texture) {
      try {
        const texture = await loadTexture(option.texture);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        sceneRef.current.background = texture;
      } catch (error) {
        console.error('Error loading texture:', error);
      }
    }

    setBackground(option);
  };

  // Reset controls to default view
  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // Reset light to default position
  const resetLight = () => {
    setLightRotation({ x: 0, y: 0 });
    setLightIntensity(1);
  };

  return {
    ...state,
    loadModel,
    lightRotation,
    setLightRotation,
    lightIntensity,
    setLightIntensity,
    background,
    setBackground: applyBackground,
    backgroundOptions,
    resetView,
    resetLight,
  };
};
