import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface UseModelViewerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadComplete?: () => void;
}

export function useModelViewer({ containerRef, onLoadComplete }: UseModelViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedModel, setLoadedModel] = useState<THREE.Group | null>(null);
  const [activeTool, setActiveTool] = useState<'none' | 'length' | 'height'>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [tempPoints, setTempPoints] = useState<MeasurementPoint[]>([]);

  const controlsRef = useRef<any>(null);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const tempPointsRef = useRef<MeasurementPoint[]>([]);
  const undoHistoryRef = useRef<Measurement[][]>([]);
  const redoHistoryRef = useRef<Measurement[][]>([]);

  let controls: any = controlsRef.current;

  useEffect(() => {
    const init = async () => {
      if (!containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      const newScene = new THREE.Scene();
      setScene(newScene);

      const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      setCamera(newCamera);

      const newRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      newRenderer.setSize(width, height);
      newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(newRenderer.domElement);
      setRenderer(newRenderer);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      newScene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(1, 1, 1);
      newScene.add(directionalLight);

      controls = new (require('three/examples/jsm/controls/OrbitControls').OrbitControls)(newCamera, newRenderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controlsRef.current = controls;

      const measurementGroup = new THREE.Group();
      measurementGroup.name = 'measurements';
      newScene.add(measurementGroup);
      measurementGroupRef.current = measurementGroup;

      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        newRenderer.render(newScene, newCamera);
      };

      animate();

      window.addEventListener('resize', () => {
        const newWidth = containerRef.current!.clientWidth;
        const newHeight = containerRef.current!.clientHeight;

        newCamera.aspect = newWidth / newHeight;
        newCamera.updateProjectionMatrix();

        newRenderer.setSize(newWidth, newHeight);
        newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      });
    };

    init();

    return () => {
      if (scene) {
        while (scene.children.length > 0) {
          scene.remove(scene.children[0]);
        }
      }
      if (renderer) {
        renderer.dispose();
        if (containerRef.current && renderer.domElement.parentNode) {
          containerRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, [containerRef]);

  const loadModel = useCallback(async (file: File) => {
    setIsLoading(true);
    setProgress(0);
    setError(null);

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.total > 0) {
        const loadedPercentage = Math.round((event.loaded / event.total) * 100);
        setProgress(loadedPercentage);
      }
    };

    reader.onload = async (event) => {
      try {
        const gltfLoader = new (require('three/examples/jsm/loaders/GLTFLoader').GLTFLoader)();
        const gltf = await gltfLoader.parse(event.target!.result as string, '');

        if (scene) {
          const model = gltf.scene;
          model.traverse((node: any) => {
            if (node.isMesh) {
              node.castShadow = true;
            }
          });

          scene.add(model);
          setLoadedModel(model);
          fitCameraToModel();
          onLoadComplete?.();
        }
      } catch (e: any) {
        setError(`Fehler beim Laden des Modells: ${e.message || 'Unbekannter Fehler'}`);
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Fehler beim Lesen der Datei.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  }, [scene, onLoadComplete, fitCameraToModel]);

  const resetView = useCallback(() => {
    if (loadedModel) {
      fitCameraToModel(true);
    }
  }, [loadedModel, fitCameraToModel]);

  const setActiveToolAndRecord = useCallback((tool: 'none' | 'length' | 'height') => {
    setActiveTool(tool);
  }, []);

  const addMeasurement = useCallback((measurement: Measurement) => {
    setMeasurements(prevMeasurements => {
      const newMeasurements = [...prevMeasurements, measurement];
      saveStateToHistory(newMeasurements);
      return newMeasurements;
    });
  }, [saveStateToHistory]);

  const updateMeasurement = useCallback((id: string, updates: Partial<Measurement>) => {
    setMeasurements(prevMeasurements => {
      const newMeasurements = prevMeasurements.map(m =>
        m.id === id ? { ...m, ...updates } : m
      );
      saveStateToHistory(newMeasurements);
      return newMeasurements;
    });

    if (measurementGroupRef.current) {
      const measurementGroup = measurementGroupRef.current.getObjectByName(`measurement-${id}`) as THREE.Group;
      if (measurementGroup) {
        Object.assign(measurementGroup.userData, updates);
      }
    }
  }, [saveStateToHistory]);

  const deleteMeasurement = useCallback((id: string) => {
    setMeasurements(prevMeasurements => {
      const newMeasurements = prevMeasurements.filter(m => m.id !== id);
      saveStateToHistory(newMeasurements);
      return newMeasurements;
    });

    if (measurementGroupRef.current && scene) {
      const measurementGroup = measurementGroupRef.current.getObjectByName(`measurement-${id}`) as THREE.Group;
      if (measurementGroup) {
        measurementGroupRef.current.remove(measurementGroup);
      }
    }
  }, [scene, saveStateToHistory]);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);

    if (measurementGroupRef.current && scene) {
      while (measurementGroupRef.current.children.length > 0) {
        measurementGroupRef.current.remove(measurementGroupRef.current.children[0]);
      }
    }
    saveStateToHistory([]);
  }, [scene, saveStateToHistory]);

  const saveStateToHistory = useCallback((newMeasurements: Measurement[]) => {
    undoHistoryRef.current.push(measurements);
    redoHistoryRef.current = [];
    setCanUndo(undoHistoryRef.current.length > 0);
    setMeasurements(newMeasurements);
  }, [measurements]);

  const undoLastPoint = useCallback(() => {
    if (undoHistoryRef.current.length === 0) return;

    setMeasurements(prevMeasurements => {
      if (tempPointsRef.current.length > 0) {
        tempPointsRef.current.pop();
        setTempPoints([...tempPointsRef.current]);
      }

      const previous = undoHistoryRef.current.pop() || [];
      redoHistoryRef.current.push(prevMeasurements);
      setCanUndo(undoHistoryRef.current.length > 0);
      return previous;
    });
  }, []);

  const deleteTempPoint = useCallback((index: number) => {
    if (tempPointsRef.current && tempPointsRef.current.length > 0 && scene) {
      const pointToRemove = tempPointsRef.current[index];
      if (pointToRemove && pointToRemove.mesh) {
        scene.remove(pointToRemove.mesh);
      }

      tempPointsRef.current.splice(index, 1);
      setTempPoints([...tempPointsRef.current]);
    }
  }, [scene]);

  const deleteSinglePoint = useCallback((measurementId: string, pointIndex: number) => {
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(measurement => {
        if (measurement.id === measurementId) {
          const updatedPoints = [...measurement.points];
          updatedPoints.splice(pointIndex, 1);

          return { ...measurement, points: updatedPoints };
        }
        return measurement;
      });
    });
  }, []);

  const toggleMeasurementsVisibility = useCallback((visible: boolean) => {
    if (measurementGroupRef.current) {
      measurementGroupRef.current.visible = visible;
    }
  }, []);

  // Improved fitCameraToModel function that respects current model orientation
  const fitCameraToModel = useCallback((resetRotation: boolean = false) => {
    if (!loadedModel || !controls || !camera) return;
    
    // Save current rotation if not resetting
    const currentRotation = !resetRotation ? new THREE.Quaternion().copy(loadedModel.quaternion) : null;
    
    // Get the bounding box
    const box = new THREE.Box3().setFromObject(loadedModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Calculate the distance based on the size and aspect ratio
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Adjust distance based on aspect ratio and device
    const aspect = camera.aspect;
    const isMobile = window.innerWidth < 768;
    
    // Calculate a better fitting distance for mobile devices
    let distance = maxDim * 1.5;
    
    // For portrait mobile, we need more distance to fit height
    if (isMobile && window.innerHeight > window.innerWidth) {
      distance = maxDim * 2.2;
    }
    
    // Calculate better camera positions
    const fov = camera.fov * (Math.PI / 180);
    const fovh = 2 * Math.atan(Math.tan(fov / 2) * aspect);
    const distanceX = (size.x / 2) / Math.tan(fovh / 2);
    const distanceY = (size.y / 2) / Math.tan(fov / 2);
    const finalDistance = Math.max(distance, distanceX, distanceY);
    
    // Position the camera
    camera.position.set(center.x, center.y, center.z + finalDistance);
    camera.lookAt(center);
    
    // Update controls target
    controls.target.copy(center);
    
    // Reset or restore rotation
    if (resetRotation) {
      loadedModel.rotation.set(0, 0, 0);
      loadedModel.quaternion.set(0, 0, 0, 1);
    } else if (currentRotation) {
      loadedModel.quaternion.copy(currentRotation);
    }
    
    // Force update
    loadedModel.updateMatrix();
    loadedModel.updateMatrixWorld(true);
    controls.update();
    
    // Force a render
    if (renderer) {
      renderer.render(scene, camera);
    }
  }, [loadedModel, controls, camera, renderer, scene]);
  
  // Enhanced clearTempPoints function to safely handle temp points
  const clearTempPoints = useCallback(() => {
    if (tempPointsRef.current && tempPointsRef.current.length > 0) {
      // Remove points from scene
      tempPointsRef.current.forEach(point => {
        if (scene && point.mesh) {
          scene.remove(point.mesh);
        }
      });
      
      // Clear the array
      tempPointsRef.current = [];
      setTempPoints([]);
    }
  }, [scene, setTempPoints]);
  
  // Return all the necessary functions and state
  return {
    activeTool,
    setActiveTool: setActiveToolAndRecord,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
    clearMeasurements,
    measurements,
    isLoading,
    progress,
    loadedModel,
    resetView,
    error,
    undoLastPoint,
    canUndo,
    measurementGroupRef,
    tempPoints,
    setTempPoints,
    deleteTempPoint,
    deleteSinglePoint,
    toggleMeasurementsVisibility,
    clearTempPoints,
    controls,
    fitCameraToModel,
  };
}
