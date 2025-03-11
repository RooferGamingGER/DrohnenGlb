
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { loadGLBModel, centerModel, loadTexture, BackgroundOption, backgroundOptions } from '@/utils/modelUtils';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const [state, setState] = useState<ModelViewerState>({
    isLoading: false,
    progress: 0,
    error: null,
    loadedModel: null,
  });
  
  const [background, setBackground] = useState<BackgroundOption>(
    backgroundOptions.find(bg => bg.id === 'dark') || backgroundOptions[0]
  );

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

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMappingExposure = 1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    lightsRef.current = {
      directional: directionalLight,
      ambient: ambientLight
    };

    // Configure orbit controls for better rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    
    // Ensure free rotation on all axes
    controls.enableRotate = true;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    
    controls.update();
    controlsRef.current = controls;

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

  const loadModel = async (file: File) => {
    try {
      if (!sceneRef.current) return;

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

      // Load the model with combined upload and loading progress
      const model = await loadGLBModel(
        file,
        (event) => {
          if (event.lengthComputable) {
            // First 50% for upload progress
            const uploadProgress = (event.loaded / event.total) * 50;
            setState(prev => ({ ...prev, progress: Math.round(uploadProgress) }));
          }
        }
      );

      // Set progress to 75% during model processing
      setState(prev => ({ ...prev, progress: 75 }));

      const box = centerModel(model);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());

      if (cameraRef.current && controlsRef.current) {
        // Calculate a better distance that ensures the model is visible but not too far
        const distance = size * 2;
        
        // Position camera for a better view (more similar to the original)
        cameraRef.current.position.set(center.x, center.y, center.z + distance);
        cameraRef.current.lookAt(center);

        // Update controls
        controlsRef.current.target.copy(center);
        
        // Ensure controls allow free rotation
        controlsRef.current.enableRotate = true;
        controlsRef.current.minPolarAngle = 0;
        controlsRef.current.maxPolarAngle = Math.PI;
        controlsRef.current.minAzimuthAngle = -Infinity;
        controlsRef.current.maxAzimuthAngle = Infinity;
        
        controlsRef.current.update();
        controlsRef.current.saveState();
      }

      sceneRef.current.add(model);
      modelRef.current = model;

      // Set progress to 100% when everything is ready
      setState({
        isLoading: false,
        progress: 100,
        error: null,
        loadedModel: model,
      });

      // Apply dark background as default
      const darkBackground = backgroundOptions.find(bg => bg.id === 'dark');
      if (darkBackground) {
        applyBackground(darkBackground);
      }

      toast({
        title: "Modell geladen",
        description: "Das 3D-Modell wurde erfolgreich geladen. Sie können es jetzt von allen Seiten betrachten.",
        duration: 3000,
      });

      return model;
    } catch (error) {
      console.error('Error loading model:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setState({
        isLoading: false,
        progress: 0,
        error: `Fehler beim Laden des Modells: ${errorMessage}`,
        loadedModel: null,
      });
      
      toast({
        title: "Fehler beim Laden",
        description: `Das Modell konnte nicht geladen werden: ${errorMessage}`,
        variant: "destructive",
        duration: 5000,
      });

      throw error;
    }
  };

  const applyBackground = async (option: BackgroundOption) => {
    if (!sceneRef.current || !rendererRef.current) return;

    if (sceneRef.current.background) {
      if (sceneRef.current.background instanceof THREE.Texture) {
        sceneRef.current.background.dispose();
      }
      sceneRef.current.background = null;
    }

    rendererRef.current.setClearAlpha(option.id === 'transparent' ? 0 : 1);

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

  const resetView = () => {
    if (controlsRef.current && modelRef.current && cameraRef.current) {
      // Get the center of the model again
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      
      // Reset the camera position with front view instead of top-down
      const distance = size * 2;
      cameraRef.current.position.set(center.x, center.y, center.z + distance);
      cameraRef.current.lookAt(center);
      
      // Reset the controls target to center of model
      controlsRef.current.target.copy(center);
      
      // Make sure rotation is enabled on all axes
      controlsRef.current.enableRotate = true;
      controlsRef.current.minPolarAngle = 0;
      controlsRef.current.maxPolarAngle = Math.PI;
      controlsRef.current.minAzimuthAngle = -Infinity;
      controlsRef.current.maxAzimuthAngle = Infinity;
      
      controlsRef.current.update();
    }
  };

  return {
    ...state,
    loadModel,
    background,
    setBackground: applyBackground,
    backgroundOptions,
    resetView,
  };
};
