
import { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { MeshoptDecoder } from 'meshoptimizer';
import { createMeasurementId, createTextSprite, updateLabelScale, createDraggablePoint, createMeasurementLine, calculateDistance, calculateHeight, calculateInclination, togglePointSelection, isDoubleClick, createDraggablePointMaterial, isInclinationSignificant, Measurement, MeasurementType, formatMeasurementWithInclination } from '@/utils/measurementUtils';

interface UseModelViewerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadComplete?: () => void;
}

interface UseModelViewer {
  isLoading: boolean;
  progress: number;
  error: string | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  loadedModel: THREE.Group | null;
  activeTool: MeasurementType;
  setActiveTool: (tool: MeasurementType) => void;
  measurements: Measurement[];
  measurementGroupRef: React.RefObject<THREE.Group> | null;
  createMeasurement: (type: MeasurementType) => void;
  updateMeasurement: (id: string, data: Partial<Measurement>) => void;
  deleteMeasurement: (id: string) => void;
  clearMeasurements: () => void;
  toggleMeasurementsVisibility: (visible: boolean) => void;
  undoLastPoint: () => void;
  canUndo: boolean;
  loadModel: (file: File) => Promise<void>;
  resetView: () => void;
  setProgress: (progress: number) => void;
  initScene: () => void;
}

export const useModelViewer = ({ containerRef, onLoadComplete }: UseModelViewerProps): UseModelViewer => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [controls, setControls] = useState<OrbitControls | null>(null);
  const [transformControls, setTransformControls] = useState<TransformControls | null>(null);
  const [loadedModel, setLoadedModel] = useState<THREE.Group | null>(null);
  const [activeTool, setActiveTool] = useState<MeasurementType>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  
  // Ref to hold the measurement points for undo functionality
  const measurementPointsRef = useRef<THREE.Vector3[][]>([]);
  
  // Ref for the group containing all measurement lines and labels
  const measurementGroupRef = useRef<THREE.Group>(new THREE.Group());
  
  // Raycaster and mouse for handling 3D object interactions
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  
  // Selected point for dragging
  const selectedPoint = useRef<THREE.Mesh | null>(null);
  
  // Double click flag
  const doubleClickFlag = useRef(false);
  
  // Store the initial camera position
  const initialCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const initialTargetPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  
  // Animation frame request ID
  const animationFrameId = useRef(0);
  
  // Function to initialize the scene
  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    
    // Initialize scene, camera, and renderer
    const newScene = new THREE.Scene();
    const newCamera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    const newRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    newRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    newRenderer.shadowMap.enabled = true;
    newRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(newRenderer.domElement);
    
    // Set initial camera position
    newCamera.position.set(5, 5, 5);
    initialCameraPosition.current.copy(newCamera.position);
    
    // Orbit controls
    const newControls = new OrbitControls(newCamera, newRenderer.domElement);
    newControls.enableDamping = true;
    newControls.dampingFactor = 0.05;
    newControls.screenSpacePanning = false;
    newControls.minDistance = 1;
    newControls.maxDistance = 50;
    newControls.target.set(0, 1, 0); // Focus slightly above the origin
    initialTargetPosition.current.copy(newControls.target);
    newControls.update();
    
    // Transform controls
    const newTransformControls = new TransformControls(new THREE.Object3D(), newCamera, newRenderer.domElement);
    newTransformControls.mode = 'translate';
    newTransformControls.size = 0.75;
    newTransformControls.showX = false;
    newTransformControls.showY = true;
    newTransformControls.showZ = false;
    newScene.add(newTransformControls);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    newScene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    newScene.add(directionalLight);
    
    // Add a ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    newScene.add(ground);
    
    // Add measurement group to the scene
    measurementGroupRef.current = new THREE.Group();
    newScene.add(measurementGroupRef.current);
    
    // Set state variables
    setScene(newScene);
    setCamera(newCamera);
    setRenderer(newRenderer);
    setControls(newControls);
    setTransformControls(newTransformControls);
    
    // Animation loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      newControls.update();
      updateLabels();
      newRenderer.render(newScene, newCamera);
    };
    animate();
    
    // Handle window resize
    const handleResize = () => {
      newCamera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      newCamera.updateProjectionMatrix();
      newRenderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', handleResize);
    
    // Event listeners for mouse interaction
    newRenderer.domElement.addEventListener('click', onDocumentMouseDown);
    newRenderer.domElement.addEventListener('dblclick', onDocumentDoubleClick);
    newRenderer.domElement.addEventListener('mousemove', onDocumentMouseMove);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      newRenderer.domElement.removeEventListener('click', onDocumentMouseDown);
      newRenderer.domElement.removeEventListener('dblclick', onDocumentDoubleClick);
      newRenderer.domElement.removeEventListener('mousemove', onDocumentMouseMove);
      cancelAnimationFrame(animationFrameId.current);
      newRenderer.dispose();
    };
  }, [containerRef]);
  
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [initScene]);
  
  // Function to load the model
  const loadModel = useCallback(async (file: File) => {
    setIsLoading(true);
    setProgress(0);
    setError(null);
    
    if (!scene) {
      console.error("Scene not initialized.");
      setError("Scene not initialized.");
      setIsLoading(false);
      return;
    }
    
    try {
      // GLTF loader
      const loader = new GLTFLoader();
      
      // DRACO compression
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');
      dracoLoader.preload();
      loader.setDRACOLoader(dracoLoader);
      
      // KTX2 compression
      const ktx2Loader = new KTX2Loader();
      ktx2Loader.setTranscoderPath('/ktx2/');
      // Fix for the argument count error - remove the third argument
      ktx2Loader.detectSupport(renderer as THREE.WebGLRenderer);
      loader.setKTX2Loader(ktx2Loader);
      
      // Meshopt compression
      loader.setMeshoptDecoder(MeshoptDecoder);
      
      loader.load(
        URL.createObjectURL(file),
        (gltf) => {
          const model = gltf.scene;
          
          // Enable shadows for all meshes in the model
          model.traverse((node: any) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          
          // Scale the model
          const boundingBox = new THREE.Box3().setFromObject(model);
          const size = boundingBox.getSize(new THREE.Vector3()).length();
          const scaleFactor = 2 / size; // Adjust the divisor to control the overall size
          model.scale.set(scaleFactor, scaleFactor, scaleFactor);
          
          // Center the model
          boundingBox.setFromObject(model);
          const center = boundingBox.getCenter(new THREE.Vector3());
          model.position.set(-center.x, -boundingBox.min.y, -center.z); // Position at the ground
          
          setLoadedModel(model);
          scene.add(model);
          
          // Reset the camera and controls
          resetView();
          
          setIsLoading(false);
          setProgress(100);
          
          if (onLoadComplete) {
            onLoadComplete();
          }
        },
        (xhr) => {
          const loadingProgress = (xhr.loaded / xhr.total) * 100;
          setProgress(loadingProgress);
        },
        (error) => {
          console.error("Error loading GLTF model:", error);
          setError(`Error loading GLTF model: ${error}`);
          setIsLoading(false);
        }
      );
    } catch (err: any) {
      console.error("Failed to load model:", err);
      setError(`Failed to load model: ${err.message || err}`);
      setIsLoading(false);
    }
  }, [scene, renderer, onLoadComplete]);
  
  // Function to reset the view
  const resetView = useCallback(() => {
    if (camera && controls) {
      camera.position.copy(initialCameraPosition.current);
      controls.target.copy(initialTargetPosition.current);
      controls.update();
    }
  }, [camera, controls]);
  
  // Function to handle mouse click events
  const onDocumentMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    
    // Fix for the type comparison error - change the condition to check if activeTool is not 'none'
    if (!renderer || !camera || !scene || activeTool === 'none') return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(mouse.current, camera);
    
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      
      if (activeTool !== 'none' && loadedModel) {
        const point = intersects[0].point;
        addMeasurementPoint(point);
      }
    }
  };
  
  // Function to handle double click events
  const onDocumentDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    
    if (!renderer || !camera || !scene) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(mouse.current, camera);
    
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      
      if (intersectedObject instanceof THREE.Mesh && intersectedObject.userData.isDraggable) {
        const now = new Date().getTime();
        
        if (isDoubleClick(now, intersectedObject.userData.lastClickTime)) {
          togglePointSelection(intersectedObject);
        }
        
        intersectedObject.userData.lastClickTime = now;
      }
    }
  };
  
  // Function to handle mouse move events
  const onDocumentMouseMove = (event: MouseEvent) => {
    event.preventDefault();
    
    if (!renderer || !camera || !scene || !transformControls) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(mouse.current, camera);
    
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      
      if (intersectedObject instanceof THREE.Mesh && intersectedObject.userData.isDraggable) {
        // Check if the mouse is over a draggable point
        const material = intersectedObject.material as THREE.MeshBasicMaterial;
        material.color.set(0xffff00);
        
        if (event.buttons > 0 && intersectedObject.userData.isSelected) {
          selectedPoint.current = intersectedObject;
          transformControls.attach(selectedPoint.current);
          transformControls.showY = true;
        }
      } else {
        // Reset the color of all draggable points
        scene.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.userData.isDraggable) {
            const material = child.material as THREE.MeshBasicMaterial;
            material.color.set(0xff0000);
          }
        });
      }
    } else {
      // Reset the color of all draggable points
      scene.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.userData.isDraggable) {
          const material = child.material as THREE.MeshBasicMaterial;
          material.color.set(0xff0000);
        }
      });
      
      // Detach transform controls if no object is intersected
      transformControls.detach();
      transformControls.showY = false;
    }
  };
  
  // Function to add a measurement point
  const addMeasurementPoint = (point: THREE.Vector3) => {
    if (!scene || !loadedModel) return;
    
    setCanUndo(true);
    
    // Get the current measurement or create a new one if none exists
    let currentMeasurement = measurements.find(m => m.isActive === true);
    
    if (!currentMeasurement) {
      createMeasurement(activeTool);
      currentMeasurement = measurements.find(m => m.isActive === true);
      if (!currentMeasurement) return;
    }
    
    // Create a new point and add it to the scene
    const measurementId = currentMeasurement.id;
    const pointName = `measurement-point-${measurementId}-${currentMeasurement.points.length}`;
    const draggablePoint = createDraggablePoint(point, pointName);
    scene.add(draggablePoint);
    
    // Update measurement points and lines
    const newPoint = {
      position: point.clone(),
      worldPosition: draggablePoint.position.clone()
    };
    
    // Save the point for undo functionality
    measurementPointsRef.current.push([point.clone()]);
    
    const updatedPoints = [...currentMeasurement.points, newPoint];
    
    // Create a new line if there are at least two points
    let newLine: THREE.Line | null = null;
    if (updatedPoints.length > 1) {
      const linePoints = updatedPoints.map(p => p.worldPosition);
      newLine = createMeasurementLine(linePoints);
      scene.add(newLine);
    }
    
    // Update the measurement with the new point, line, and calculated values
    updateMeasurementState(currentMeasurement.id, updatedPoints, draggablePoint, newLine);
  };
  
  // Function to create a measurement
  const createMeasurement = (type: MeasurementType) => {
    const id = createMeasurementId();
    
    const newMeasurement: Measurement = {
      id: id,
      type: type,
      points: [],
      value: 0,
      unit: 'm',
      isActive: true,
      visible: true,
      labelObject: undefined,
      lineObjects: [],
      pointObjects: []
    };
    
    setMeasurements(prevMeasurements => [...prevMeasurements, newMeasurement]);
  };
  
  // Function to update a measurement
  const updateMeasurement = useCallback((id: string, data: Partial<Measurement>) => {
    setMeasurements(prevMeasurements =>
      prevMeasurements.map(m => (m.id === id ? { ...m, ...data } : m))
    );
  }, []);
  
  // Function to delete a measurement
  const deleteMeasurement = (id: string) => {
    if (!scene || !loadedModel) return;
    
    setMeasurements(prevMeasurements => {
      const measurementToDelete = prevMeasurements.find(m => m.id === id);
      
      if (measurementToDelete) {
        // Remove the label from the scene
        if (measurementToDelete.labelObject) {
          scene.remove(measurementToDelete.labelObject);
        }
        
        // Remove the lines from the scene
        if (measurementToDelete.lineObjects) {
          measurementToDelete.lineObjects.forEach(line => scene.remove(line));
        }
        
        // Remove the points from the scene
        if (measurementToDelete.pointObjects) {
          measurementToDelete.pointObjects.forEach(point => scene.remove(point));
        }
      }
      
      // Filter out the measurement to be deleted
      const updatedMeasurements = prevMeasurements.filter(m => m.id !== id);
      return updatedMeasurements;
    });
  };
  
  // Function to clear all measurements
  const clearMeasurements = () => {
    if (!scene || !loadedModel) return;
    
    setMeasurements(prevMeasurements => {
      prevMeasurements.forEach(measurement => {
        // Remove the label from the scene
        if (measurement.labelObject) {
          scene.remove(measurement.labelObject);
        }
        
        // Remove the lines from the scene
        if (measurement.lineObjects) {
          measurement.lineObjects.forEach(line => scene.remove(line));
        }
        
        // Remove the points from the scene
        if (measurement.pointObjects) {
          measurement.pointObjects.forEach(point => scene.remove(point));
        }
      });
      
      return [];
    });
    
    setCanUndo(false);
  };
  
  // Function to toggle visibility of all measurements
  const toggleMeasurementsVisibility = (visible: boolean) => {
    if (!scene || !loadedModel) return;
    
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(measurement => {
        // Update visibility state
        const updatedMeasurement = { ...measurement, visible: visible };
        
        // Update visibility of label
        if (updatedMeasurement.labelObject) {
          updatedMeasurement.labelObject.visible = visible;
        }
        
        // Update visibility of lines
        if (updatedMeasurement.lineObjects) {
          updatedMeasurement.lineObjects.forEach(line => line.visible = visible);
        }
        
        // Update visibility of points
        if (updatedMeasurement.pointObjects) {
          updatedMeasurement.pointObjects.forEach(point => point.visible = visible);
        }
        
        return updatedMeasurement;
      });
    });
  };
  
  // Function to undo the last point
  const undoLastPoint = () => {
    if (!scene) return;
    
    setMeasurements(prevMeasurements => {
      // Find the active measurement
      const currentMeasurement = prevMeasurements.find(m => m.isActive === true);
      
      if (!currentMeasurement || currentMeasurement.points.length === 0) {
        setCanUndo(false);
        return prevMeasurements;
      }
      
      // Remove the last point from the scene
      const lastPoint = currentMeasurement.pointObjects?.pop();
      if (lastPoint) {
        scene.remove(lastPoint);
      }
      
      // Remove the last line from the scene
      const lastLine = currentMeasurement.lineObjects?.pop();
      if (lastLine) {
        scene.remove(lastLine);
      }
      
      // Remove the last point from the points array
      currentMeasurement.points.pop();
      
      // Remove the last point from the measurementPointsRef
      measurementPointsRef.current.pop();
      
      // Update the measurement state
      updateMeasurementState(currentMeasurement.id, currentMeasurement.points, null, null);
      
      if (currentMeasurement.points.length === 0) {
        setCanUndo(false);
      }
      
      return [...prevMeasurements];
    });
  };
  
  // Function to update the measurement state
  const updateMeasurementState = (
    id: string,
    updatedPoints: { position: THREE.Vector3; worldPosition: THREE.Vector3; }[],
    draggablePoint: THREE.Mesh | null,
    newLine: THREE.Line | null
  ) => {
    if (!scene || !camera) return;
    
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(measurement => {
        if (measurement.id === id) {
          // Deactivate the measurement if it has the maximum number of points
          const isActive = updatedPoints.length < 2;
          
          // Calculate the new value based on the measurement type
          let newValue = 0;
          let newInclination: number | undefined = undefined;
          
          if (updatedPoints.length === 2) {
            const p1 = updatedPoints[0].worldPosition;
            const p2 = updatedPoints[1].worldPosition;
            
            if (measurement.type === 'length') {
              newValue = calculateDistance(p1, p2);
              newInclination = calculateInclination(p1, p2);
            } else if (measurement.type === 'height') {
              newValue = calculateHeight(p1, p2);
            }
          }
          
          // Update the label text
          let labelText = `${newValue.toFixed(2)} m`;
          if (measurement.type === 'length' && newInclination !== undefined) {
            labelText = formatMeasurementWithInclination(newValue, newInclination);
          }
          
          // Remove the old label from the scene
          if (measurement.labelObject) {
            scene.remove(measurement.labelObject);
          }
          
          // Create a new label
          const labelPosition = updatedPoints.length > 0
            ? updatedPoints[updatedPoints.length - 1].worldPosition
            : new THREE.Vector3();
          const newLabel = createTextSprite(labelText, labelPosition);
          scene.add(newLabel);
          
          // Add the draggable point to the point objects array
          const newPointObjects = draggablePoint ? [...measurement.pointObjects || [], draggablePoint] : measurement.pointObjects || [];
          
          // Add the new line to the line objects array
          const newLineObjects = newLine ? [...measurement.lineObjects || [], newLine] : measurement.lineObjects || [];
          
          const updatedMeasurement: Measurement = {
            ...measurement,
            points: updatedPoints,
            value: newValue,
            inclination: newInclination,
            isActive: isActive,
            labelObject: newLabel,
            lineObjects: newLineObjects,
            pointObjects: newPointObjects
          };
          
          return updatedMeasurement;
        }
        
        return measurement;
      });
    });
  };
  
  // Function to update the labels
  const updateLabels = () => {
    if (!camera) return;
    
    measurements.forEach(measurement => {
      if (measurement.labelObject) {
        updateLabelScale(measurement.labelObject, camera);
      }
    });
  };
  
  return {
    isLoading,
    progress,
    error,
    scene,
    camera,
    renderer,
    loadedModel,
    activeTool,
    setActiveTool,
    measurements,
    measurementGroupRef,
    createMeasurement,
    updateMeasurement,
    deleteMeasurement,
    clearMeasurements,
    toggleMeasurementsVisibility,
    undoLastPoint,
    canUndo,
    loadModel,
    resetView,
    setProgress,
    initScene
  };
};
