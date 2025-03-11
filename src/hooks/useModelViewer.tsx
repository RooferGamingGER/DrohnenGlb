import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { 
  loadGLBModel, 
  centerModel, 
  loadTexture, 
  BackgroundOption, 
  backgroundOptions 
} from '@/utils/modelUtils';
import {
  MeasurementType,
  Measurement,
  MeasurementPoint,
  calculateDistance,
  calculateHeight,
  calculateArea,
  createMeasurementId,
  createTextSprite,
  updateLabelScale,
  createDraggablePointMaterial,
  createMeasurementLineMaterial,
  createTemporaryLineMaterial,
  createAreaMaterial
} from '@/utils/measurementUtils';
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
    backgroundOptions.find(bg => bg.id === 'light') || backgroundOptions[0]
  );
  
  const [activeTool, setActiveTool] = useState<MeasurementType>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [temporaryPoints, setTemporaryPoints] = useState<MeasurementPoint[]>([]);

  // Dragging state
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const draggedPointRef = useRef<THREE.Mesh | null>(null);

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
  const processingStartTimeRef = useRef<number | null>(null);
  const uploadProgressRef = useRef<number>(0);
  const processingIntervalRef = useRef<number | null>(null);
  
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const previousMouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const currentMeasurementRef = useRef<{
    points: THREE.Vector3[];
    lines: THREE.Line[];
    labels: THREE.Sprite[];
    meshes: THREE.Mesh[];
    areaMesh?: THREE.Mesh;
  } | null>(null);

  // Preview elements for active measurement
  const previewLineRef = useRef<THREE.Line | null>(null);
  const previewPointRef = useRef<THREE.Mesh | null>(null);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const loadModel = useCallback(async (file: File) => {
    if (!sceneRef.current || !cameraRef.current) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    processingStartTimeRef.current = Date.now();

    try {
      const model = await loadGLBModel(file, (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          uploadProgressRef.current = progress;
          setState(prev => ({ ...prev, progress }));
        }
      });

      // Remove existing model if any
      if (modelRef.current) {
        sceneRef.current.remove(modelRef.current);
      }

      // Add new model
      sceneRef.current.add(model);
      modelRef.current = model;

      // Center model and adjust camera
      const box = centerModel(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      cameraRef.current.position.z = maxDim * 2;
      controlsRef.current?.target.set(0, 0, 0);
      controlsRef.current?.update();

      setState(prev => ({
        ...prev,
        isLoading: false,
        loadedModel: model,
        error: null
      }));

    } catch (error) {
      console.error('Error loading model:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load model'
      }));
      
      toast({
        title: "Error",
        description: "Failed to load 3D model",
        variant: "destructive"
      });
    }
  }, [toast]);

  const resetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current || !modelRef.current) return;

    const box = new THREE.Box3().setFromObject(modelRef.current);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    cameraRef.current.position.set(0, 0, maxDim * 2);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  }, []);

  const takeScreenshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    // Temporarily hide measurement points for cleaner screenshot
    const pointsVisible = measurementGroupRef.current?.children.map(child => {
      if (child instanceof THREE.Mesh) {
        const wasVisible = child.visible;
        child.visible = false;
        return wasVisible;
      }
      return true;
    });

    // Render the scene
    rendererRef.current.render(sceneRef.current, cameraRef.current);

    // Get the canvas data
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');

    // Restore point visibility
    if (pointsVisible && measurementGroupRef.current) {
      measurementGroupRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh) {
          child.visible = pointsVisible[index];
        }
      });
    }

    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'measurement-screenshot.png';
    link.click();
  }, []);

  const clearMeasurements = useCallback(() => {
    if (!measurementGroupRef.current) return;

    // Remove all measurement objects from the scene
    measurements.forEach(measurement => {
      if (measurement.labelObject) {
        if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
          measurement.labelObject.material.map?.dispose();
          measurement.labelObject.material.dispose();
        }
        measurementGroupRef.current?.remove(measurement.labelObject);
      }

      if (measurement.lineObjects) {
        measurement.lineObjects.forEach(line => {
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(line);
        });
      }

      if (measurement.pointObjects) {
        measurement.pointObjects.forEach(point => {
          point.geometry.dispose();
          (point.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(point);
        });
      }

      if (measurement.areaObject) {
        measurement.areaObject.geometry.dispose();
        (measurement.areaObject.material as THREE.Material).dispose();
        measurementGroupRef.current?.remove(measurement.areaObject);
      }
    });

    setMeasurements([]);
    setTemporaryPoints([]);
    setActiveTool('none');
  }, [measurements]);

  const updateMeasurement = useCallback((id: string, data: Partial<Measurement>) => {
    setMeasurements(prev => prev.map(m => 
      m.id === id ? { ...m, ...data } : m
    ));
  }, []);

  useEffect(() => {
    setCanUndo(temporaryPoints.length > 0);
  }, [temporaryPoints]);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return;
      
      // Update mouse position
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Handle dragging of measurement points
      if (isDraggingPoint && draggedPointRef.current && modelRef.current && cameraRef.current) {
        event.preventDefault();
        
        // Update raycaster with current mouse position
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        
        // Find intersection with the model
        const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
        
        if (intersects.length > 0) {
          // Move the point to the new intersection position
          const newPosition = intersects[0].point.clone();
          
          // Update the dragged point's position
          draggedPointRef.current.position.copy(newPosition);
          
          // Update the measurement in state
          if (selectedMeasurementId !== null && selectedPointIndex !== null) {
            updateMeasurementPointPosition(
              selectedMeasurementId, 
              selectedPointIndex, 
              newPosition
            );
          }
        }
      }
      // Normal hover detection for model or measurement points
      else if (activeTool !== 'none' && modelRef.current && cameraRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
        
        if (intersects.length > 0) {
          const newHoverPoint = intersects[0].point.clone();
          setHoverPoint(newHoverPoint);
          
          // Update preview line if we have temporary points
          if (temporaryPoints.length > 0) {
            const lastPoint = temporaryPoints[temporaryPoints.length - 1].position;
            updatePreviewLine(lastPoint, newHoverPoint);
          }
        } else {
          setHoverPoint(null);
          
          // Remove preview line if mouse is not over model
          if (previewLineRef.current && measurementGroupRef.current) {
            measurementGroupRef.current.remove(previewLineRef.current);
            previewLineRef.current.geometry.dispose();
            if (Array.isArray(previewLineRef.current.material)) {
              previewLineRef.current.material.forEach(m => m.dispose());
            } else {
              previewLineRef.current.material.dispose();
            }
            previewLineRef.current = null;
          }
        }
      }
      // Check if we're hovering over any measurement points
      else if (activeTool === 'none' && measurementGroupRef.current && cameraRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        
        // Filter for meshes only (points)
        const pointObjects = measurementGroupRef.current.children.filter(
          child => child instanceof THREE.Mesh && child.name.startsWith('point-')
        );
        
        const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
        
        if (intersects.length > 0) {
          const pointId = intersects[0].object.name;
          setHoveredPointId(pointId);
          document.body.style.cursor = 'grab';
          
          // Update the point material to show it's hoverable
          if (intersects[0].object instanceof THREE.Mesh) {
            intersects[0].object.material = createDraggablePointMaterial(true);
          }
        } else {
          if (hoveredPointId) {
            // Reset any previously hovered point material
            const prevHoveredPoint = measurementGroupRef.current.children.find(
              child => child.name === hoveredPointId
            );
            
            if (prevHoveredPoint && prevHoveredPoint instanceof THREE.Mesh) {
              prevHoveredPoint.material = createDraggablePointMaterial(false);
            }
          }
          
          setHoveredPointId(null);
          document.body.style.cursor = 'auto';
        }
      } else {
        if (hoverPoint) setHoverPoint(null);
        if (hoveredPointId) setHoveredPointId(null);
        document.body.style.cursor = 'auto';
      }
      
      // Store the current mouse position for the next frame
      previousMouseRef.current.copy(mouseRef.current);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!containerRef.current || !measurementGroupRef.current) return;
      
      // Check if we're clicking on a measurement point
      if (hoveredPointId && !isDraggingPoint) {
        event.preventDefault();
        event.stopPropagation();
        
        // Find the point mesh
        const pointMesh = measurementGroupRef.current.children.find(
          child => child.name === hoveredPointId
        ) as THREE.Mesh;
        
        if (pointMesh) {
          // Start dragging
          setIsDraggingPoint(true);
          draggedPointRef.current = pointMesh;
          document.body.style.cursor = 'grabbing';
          
          // Get measurement ID and point index from the point name
          // Format: point-{measurementId}-{pointIndex}
          const nameParts = hoveredPointId.split('-');
          if (nameParts.length >= 3) {
            const measurementId = nameParts[1];
            const pointIndex = parseInt(nameParts[2], 10);
            
            setSelectedMeasurementId(measurementId);
            setSelectedPointIndex(pointIndex);
            
            // Disable orbit controls while dragging
            if (controlsRef.current) {
              controlsRef.current.enabled = false;
            }
          }
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (isDraggingPoint) {
        // Finish dragging
        setIsDraggingPoint(false);
        draggedPointRef.current = null;
        document.body.style.cursor = hoveredPointId ? 'grab' : 'auto';
        
        // Re-enable orbit controls
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
        
        // Clear selection
        setSelectedMeasurementId(null);
        setSelectedPointIndex(null);
      }
    };

    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    activeTool,
    isDraggingPoint,
    hoveredPointId,
    temporaryPoints,
    hoverPoint,
    updateMeasurementPointPosition
  ]);

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    lightsRef.current = {
      directional: directionalLight,
      ambient: ambientLight
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.update();
    controlsRef.current = controls;
    
    const measurementGroup = new THREE.Group();
    measurementGroup.name = "measurements";
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    const animate = () => {
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (measurementGroupRef.current && cameraRef.current) {
        measurementGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Sprite) {
            // Keep sprites facing the camera
            child.quaternion.copy(cameraRef.current!.quaternion);
          
            // Dynamically scale labels based on distance
            if (child.userData && child.userData.isLabel) {
              updateLabelScale(child, cameraRef.current);
            }
          }
        });
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

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = background.color ? 
        new THREE.Color(background.color) : 
        null;
    }
  }, [background]);

  return {
    isLoading: state.isLoading,
    progress: state.progress,
    error: state.error,
    loadedModel: state.loadedModel,
    loadModel,
    background,
    setBackground,
    backgroundOptions,
    resetView,
    activeTool,
    setActiveTool,
    measurements,
    clearMeasurements,
    undoLastPoint,
    deleteMeasurement,
    updateMeasurement,
    canUndo,
    takeScreenshot
  };
};
