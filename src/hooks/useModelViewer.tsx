import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { MeasurementType, Measurement, MeasurementPoint } from '@/utils/measurementUtils';
import { extractCameraPositionFromModel } from '@/utils/modelUtils';

interface ModelViewerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadComplete?: () => void;
}

export const useModelViewer = ({ containerRef, onLoadComplete }: ModelViewerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [controls, setControls] = useState<OrbitControls | null>(null);
  const [loadedModel, setLoadedModel] = useState<THREE.Object3D | null>(null);
  const [activeTool, setActiveTool] = useState<MeasurementType>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const undoHistoryRef = useRef<Measurement[][]>([]);
  const redoHistoryRef = useRef<Measurement[][]>([]);

  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Add state to expose tempPoints
  const [tempPoints, setTempPoints] = useState<MeasurementPoint[]>([]);

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0xFAFAFA);

    const ambientLight = new THREE.AmbientLight(0x404040);
    newScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    newScene.add(directionalLight);

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    newCamera.position.z = 5;

    const newRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    newRenderer.setSize(width, height);
    newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(newRenderer.domElement);

    const newControls = new OrbitControls(newCamera, newRenderer.domElement);
    newControls.enableDamping = true;
    newControls.dampingFactor = 0.05;
    newControls.screenSpacePanning = false;
    newControls.minDistance = 1;
    newControls.maxDistance = 50;

    setScene(newScene);
    setCamera(newCamera);
    setRenderer(newRenderer);
    setControls(newControls);

    const newMeasurementGroup = new THREE.Group();
    newScene.add(newMeasurementGroup);
    measurementGroupRef.current = newMeasurementGroup;

    const tick = () => {
      if (isLoading) return;
      const delta = clockRef.current.getDelta();
      mixerRef.current?.update(delta);
      newControls.update();
      newRenderer.render(newScene, newCamera);
      requestAnimationFrame(tick);
    };

    tick();

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;
      newCamera.aspect = newWidth / newHeight;
      newCamera.updateProjectionMatrix();
      newRenderer.setSize(newWidth, newHeight);
      newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      newRenderer.dispose();
    };
  }, [containerRef, isLoading]);

  useEffect(() => {
    return initScene();
  }, [initScene]);

  const loadModel = useCallback(async (file: File) => {
    setIsLoading(true);
    setProgress(0);
    setError(null);

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        if (!scene || !camera || !renderer) {
          throw new Error("Scene not initialized");
        }

        const contents = event.target?.result;
        if (typeof contents !== 'string') {
          throw new Error("Failed to read file content");
        }

        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        gltfLoader.setDRACOLoader(dracoLoader);

        gltfLoader.load(
          contents,
          (gltf) => {
            const model = gltf.scene;
            scene.add(model);

            // Extract camera position from the model, if available
            const newCameraPosition = extractCameraPositionFromModel(model);
            if (newCameraPosition) {
              camera.position.copy(newCameraPosition);
            } else {
              // Reset camera position if no camera is found in the model
              camera.position.set(0, 0, 5);
            }

            // Handle animations
            if (gltf.animations && gltf.animations.length > 0) {
              mixerRef.current = new THREE.AnimationMixer(model);
              gltf.animations.forEach(animation => {
                mixerRef.current?.clipAction(animation).play();
              });
            }

            setLoadedModel(model);
            resetView();
            setIsLoading(false);
            onLoadComplete?.();
          },
          (xhr) => {
            const loadingProgress = Math.round((xhr.loaded / xhr.total) * 100);
            setProgress(loadingProgress);
          },
          (error) => {
            console.error("An error happened:", error);
            setError(`Failed to load model: ${error.message || 'Unknown error'}`);
            setIsLoading(false);
          }
        );
      } catch (err: any) {
        console.error("An error occurred:", err);
        setError(`Failed to load model: ${err.message || 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    reader.onprogress = (event) => {
      if (event.total > 0) {
        const loadingProgress = Math.round((event.loaded / event.total) * 100);
        setProgress(loadingProgress);
      }
    };

    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      setError(`Failed to read file: Unknown error`);
      setIsLoading(false);
    };

    reader.readAsDataURL(file);
  }, [scene, camera, renderer, onLoadComplete]);

  const resetView = useCallback(() => {
    if (!loadedModel || !camera || !controls) return;

    // Reset the camera to its initial position
    camera.position.set(0, 0, 5);

    // Reset the controls to focus on the model
    controls.target.set(0, 0, 0);
    controls.update();
  }, [loadedModel, camera, controls]);

  const clearMeasurements = useCallback(() => {
    if (measurementGroupRef.current) {
      // Remove all measurement objects from the scene
      while (measurementGroupRef.current.children.length > 0) {
        measurementGroupRef.current.remove(measurementGroupRef.current.children[0]);
      }
    }

    setMeasurements([]);
    setCanUndo(false);
    undoHistoryRef.current = [];
    redoHistoryRef.current = [];
  }, []);

  const deleteMeasurement = useCallback((id: string) => {
    if (!measurementGroupRef.current) return;

    // Find the measurement to be deleted
    const measurementToDelete = measurements.find(m => m.id === id);

    if (measurementToDelete) {
      // Save current state to undo history
      undoHistoryRef.current.push([...measurements]);
      setCanUndo(true);
      redoHistoryRef.current = [];

      // Remove the measurement from the scene
      measurementToDelete.points.forEach((_, index) => {
        const pointToRemove = measurementGroupRef.current!.getObjectByName(`point-${id}-${index}`);
        if (pointToRemove) {
          measurementGroupRef.current!.remove(pointToRemove);
        }
      });

      // Remove the lines and labels
      const lineToRemove = measurementGroupRef.current.getObjectByName(`line-${id}`);
      if (lineToRemove) {
        measurementGroupRef.current.remove(lineToRemove);
      }

      const labelToRemove = measurementGroupRef.current.getObjectByName(`label-${id}`);
      if (labelToRemove) {
        measurementGroupRef.current.remove(labelToRemove);
      }

      // Update the measurements state
      setMeasurements(prevMeasurements => prevMeasurements.filter(m => m.id !== id));
    }
  }, [measurements]);

  const undoLastPoint = useCallback(() => {
    if (undoHistoryRef.current.length === 0) return;

    if (measurementGroupRef.current) {
      // Remove all measurement objects from the scene
      while (measurementGroupRef.current.children.length > 0) {
        measurementGroupRef.current.remove(measurementGroupRef.current.children[0]);
      }
    }

    // Get the last state from the undo history
    const lastState = undoHistoryRef.current.pop();
    if (lastState) {
      // Save current state to redo history
      redoHistoryRef.current.push([...measurements]);

      // Update the measurements state with the last state
      setMeasurements(lastState);

      if (undoHistoryRef.current.length === 0) {
        setCanUndo(false);
      }
    }
  }, [measurements]);

  const updateMeasurement = useCallback((id: string, data: Partial<Measurement>) => {
    setMeasurements(prevMeasurements =>
      prevMeasurements.map(m => (m.id === id ? { ...m, ...data } : m))
    );
  }, []);

  const toggleMeasurementsVisibility = useCallback((visible: boolean) => {
    if (!measurementGroupRef.current) return;

    measurementGroupRef.current.visible = visible;
  }, []);

  // Add function to clear temporary points
  const clearTempPoints = useCallback(() => {
    // Remove any temporary points from the scene
    if (measurementGroupRef.current) {
      const pointsToRemove = [];

      measurementGroupRef.current.children.forEach(child => {
        if (child.name.startsWith('temp-point')) {
          pointsToRemove.push(child);
        }
      });

      pointsToRemove.forEach(point => {
        measurementGroupRef.current?.remove(point);
      });
    }

    // Clear the temporary points array
    setTempPoints([]);
  }, [measurementGroupRef]);

  // Update the placePoint function to track temporary points
  const placePoint = useCallback((position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;

    // Create a measurement point
    const geometry = new THREE.SphereGeometry(0.03, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const point = new THREE.Mesh(geometry, material);
    point.position.copy(position);

    // Add temporary name to identify this point as part of the current measurement
    point.name = `temp-point-${tempPoints.length}`;

    measurementGroupRef.current.add(point);

    const newPoint: MeasurementPoint = {
      position: position.clone(),
      worldPosition: position.clone(),
    };

    const updatedPoints = [...tempPoints, newPoint];
    setTempPoints(updatedPoints);

    return updatedPoints;
  }, [tempPoints, measurementGroupRef]);

  const addMeasurement = useCallback((type: MeasurementType, points: MeasurementPoint[], value: number, inclination?: number) => {
    const id = Date.now().toString();

    const newMeasurement: Measurement = {
      id,
      type,
      points,
      value,
      unit: 'm',
      visible: true,
      editMode: false,
      description: '',
      inclination,
    };

    setMeasurements(prev => [...prev, newMeasurement]);

    // Clear temporary points after adding the measurement
    setTempPoints([]);

    return newMeasurement;
  }, []);

  return {
    isLoading,
    progress,
    error,
    scene,
    camera,
    renderer,
    controls,
    loadedModel,
    loadModel,
    resetView,
    activeTool,
    setActiveTool,
    measurements,
    setMeasurements,
    clearMeasurements,
    deleteMeasurement,
    undoLastPoint,
    canUndo,
    updateMeasurement,
    measurementGroupRef,
    toggleMeasurementsVisibility,
    initScene,
    addMeasurement,
    clearTempPoints,
    tempPoints,
    setProgress,
  };
};
