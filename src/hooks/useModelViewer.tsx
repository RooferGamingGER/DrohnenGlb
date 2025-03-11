
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
  } | null>({ points: [], lines: [], labels: [], meshes: [] });

  // Preview elements for active measurement
  const previewLineRef = useRef<THREE.Line | null>(null);
  const previewPointRef = useRef<THREE.Mesh | null>(null);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Function to update measurement point position
  const updateMeasurementPointPosition = useCallback((
    measurementId: string, 
    pointIndex: number, 
    newPosition: THREE.Vector3
  ) => {
    setMeasurements(prev => {
      return prev.map(measurement => {
        if (measurement.id !== measurementId) return measurement;
        
        // Create a copy of the points array
        const newPoints = [...measurement.points];
        
        // Update the point at the specified index
        newPoints[pointIndex] = {
          ...newPoints[pointIndex],
          position: newPosition.clone(),
          worldPosition: newPosition.clone()
        };
        
        // Recalculate measurement value based on type
        let newValue = 0;
        if (measurement.type === 'length') {
          // For length, calculate distance between start and end points
          newValue = calculateDistance(
            newPoints[0].position,
            newPoints[1].position
          );
        } else if (measurement.type === 'height') {
          // For height, calculate height difference
          newValue = calculateHeight(
            newPoints[0].position,
            newPoints[1].position
          );
        } else if (measurement.type === 'area') {
          // For area, recalculate area with all points
          const positions = newPoints.map(p => p.position);
          newValue = calculateArea(positions);
        }
        
        // Update the corresponding line objects if they exist
        if (measurement.lineObjects && measurementGroupRef.current) {
          // Update lines connecting to this point
          for (let i = 0; i < measurement.lineObjects.length; i++) {
            const line = measurement.lineObjects[i];
            if (i === pointIndex || i === pointIndex - 1) {
              // This line needs to be updated
              const geometry = line.geometry as THREE.BufferGeometry;
              const positions = geometry.getAttribute('position');
              
              // Check the type and cast to Float32BufferAttribute
              if (positions instanceof THREE.Float32BufferAttribute) {
                // For each line, we need to update one of its endpoints
                if (i === pointIndex) {
                  // This line ends at the modified point
                  positions.setXYZ(1, newPosition.x, newPosition.y, newPosition.z);
                } else {
                  // This line starts at the modified point
                  positions.setXYZ(0, newPosition.x, newPosition.y, newPosition.z);
                }
                
                positions.needsUpdate = true;
              }
            }
          }
          
          // If it's an area measurement, update the closing line as well
          if (measurement.type === 'area' && pointIndex === newPoints.length - 1) {
            const lastLine = measurement.lineObjects[measurement.lineObjects.length - 1];
            const geometry = lastLine.geometry as THREE.BufferGeometry;
            const positions = geometry.getAttribute('position');
            
            // Check the type and cast to Float32BufferAttribute
            if (positions instanceof THREE.Float32BufferAttribute) {
              positions.setXYZ(0, newPosition.x, newPosition.y, newPosition.z);
              positions.needsUpdate = true;
            }
          }
          
          // Update area mesh if it exists
          if (measurement.type === 'area' && measurement.areaObject) {
            const positions = newPoints.map(p => p.position);
            const areaGeometry = new THREE.BufferGeometry();
            
            // Create vertices for triangulation (fan triangulation from first point)
            const vertices = [];
            for (let i = 1; i < positions.length - 1; i++) {
              vertices.push(positions[0].x, positions[0].y, positions[0].z);
              vertices.push(positions[i].x, positions[i].y, positions[i].z);
              vertices.push(positions[i+1].x, positions[i+1].y, positions[i+1].z);
            }
            
            areaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            measurement.areaObject.geometry.dispose();
            measurement.areaObject.geometry = areaGeometry;
          }
        }
        
        // Update the label position and text for the measurement
        if (measurement.labelObject && newValue !== measurement.value) {
          // Calculate the midpoint for label positioning
          let labelPosition: THREE.Vector3;
          
          if (measurement.type === 'length' || measurement.type === 'height') {
            // For length and height, put label at midpoint between start and end
            labelPosition = new THREE.Vector3().addVectors(
              newPoints[0].position,
              newPoints[1].position
            ).multiplyScalar(0.5);
            
            // Offset label a bit for better visibility
            if (measurement.type === 'height') {
              labelPosition.x += 0.1; // Small offset in X direction
            } else {
              labelPosition.y += 0.1; // Small offset in Y direction
            }
          } else {
            // For area, calculate centroid of all points
            labelPosition = new THREE.Vector3();
            for (const point of newPoints) {
              labelPosition.add(point.position);
            }
            labelPosition.divideScalar(newPoints.length);
            labelPosition.y += 0.2; // Lift label up a bit
          }
          
          // Update the label position
          measurement.labelObject.position.copy(labelPosition);
          
          // Update the label text
          const labelText = `${newValue.toFixed(2)} ${measurement.unit}`;
          if (measurement.labelObject.material instanceof THREE.SpriteMaterial && 
              measurement.labelObject.material.map instanceof THREE.CanvasTexture) {
            // Get the canvas from the texture
            const canvas = measurement.labelObject.material.map.image;
            const context = canvas.getContext('2d');
            
            if (context) {
              // Clear the canvas
              context.clearRect(0, 0, canvas.width, canvas.height);
              
              // Redraw background
              context.fillStyle = 'rgba(255, 255, 255, 0.9)';
              context.roundRect(0, 0, canvas.width, canvas.height, 16);
              context.fill();
              
              // Add border
              context.strokeStyle = '#1e88e5';
              context.lineWidth = 4;
              context.roundRect(2, 2, canvas.width-4, canvas.height-4, 14);
              context.stroke();
              
              // Redraw text
              context.font = 'bold 48px Inter, sans-serif';
              context.textAlign = 'center';
              context.textBaseline = 'middle';
              context.fillStyle = '#1e88e5';
              context.fillText(labelText, canvas.width / 2, canvas.height / 2);
              
              // Update the texture
              measurement.labelObject.material.map.needsUpdate = true;
            }
          }
        }
        
        // Return the updated measurement
        return {
          ...measurement,
          points: newPoints,
          value: newValue
        };
      });
    });
  }, []);

  // Function to update the preview line
  const updatePreviewLine = useCallback((startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    // Remove existing preview line if any
    if (previewLineRef.current) {
      measurementGroupRef.current.remove(previewLineRef.current);
      previewLineRef.current.geometry.dispose();
      if (Array.isArray(previewLineRef.current.material)) {
        previewLineRef.current.material.forEach(m => m.dispose());
      } else {
        previewLineRef.current.material.dispose();
      }
      previewLineRef.current = null;
    }
    
    // Create new preview line
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
    const line = new THREE.Line(lineGeometry, createTemporaryLineMaterial());
    line.name = 'preview-line';
    measurementGroupRef.current.add(line);
    previewLineRef.current = line;
  }, []);

  // Function to delete a measurement
  const deleteMeasurement = useCallback((id: string) => {
    // Find the measurement
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !measurementGroupRef.current) return;
    
    // Remove all 3D objects for this measurement
    if (measurement.labelObject) {
      if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
        measurement.labelObject.material.map?.dispose();
        measurement.labelObject.material.dispose();
      }
      measurementGroupRef.current.remove(measurement.labelObject);
    }
    
    if (measurement.lineObjects) {
      measurement.lineObjects.forEach(line => {
        line.geometry.dispose();
        if (Array.isArray(line.material)) {
          line.material.forEach(m => m.dispose());
        } else {
          line.material.dispose();
        }
        measurementGroupRef.current?.remove(line);
      });
    }
    
    if (measurement.pointObjects) {
      measurement.pointObjects.forEach(point => {
        point.geometry.dispose();
        if (Array.isArray(point.material)) {
          point.material.forEach(m => m.dispose());
        } else {
          point.material.dispose();
        }
        measurementGroupRef.current?.remove(point);
      });
    }
    
    if (measurement.areaObject) {
      measurement.areaObject.geometry.dispose();
      if (Array.isArray(measurement.areaObject.material)) {
        measurement.areaObject.material.forEach(m => m.dispose());
      } else {
        measurement.areaObject.material.dispose();
      }
      measurementGroupRef.current.remove(measurement.areaObject);
    }
    
    // Remove measurement from state
    setMeasurements(prev => prev.filter(m => m.id !== id));
  }, [measurements]);

  // Function to undo the last point
  const undoLastPoint = useCallback(() => {
    if (temporaryPoints.length > 0) {
      // Remove the last temporary point
      setTemporaryPoints(prev => prev.slice(0, -1));
      
      // Clean up any related 3D objects
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
    
    // Update canUndo state
    setCanUndo(temporaryPoints.length > 1);
  }, [temporaryPoints]);

  // Function to update a measurement description
  const updateMeasurement = useCallback((id: string, updates: Partial<Measurement>) => {
    setMeasurements(prev => 
      prev.map(measurement => 
        measurement.id === id 
          ? { ...measurement, ...updates } 
          : measurement
      )
    );
  }, []);

  // Function to clear all measurements
  const clearMeasurements = useCallback(() => {
    if (!measurementGroupRef.current) return;
    
    // Clear all measurements from the scene
    measurements.forEach(measurement => {
      // Dispose label
      if (measurement.labelObject) {
        if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
          measurement.labelObject.material.map?.dispose();
          measurement.labelObject.material.dispose();
        }
        measurementGroupRef.current?.remove(measurement.labelObject);
      }
      
      // Dispose lines
      if (measurement.lineObjects) {
        measurement.lineObjects.forEach(line => {
          line.geometry.dispose();
          if (Array.isArray(line.material)) {
            line.material.forEach(m => m.dispose());
          } else {
            line.material.dispose();
          }
          measurementGroupRef.current?.remove(line);
        });
      }
      
      // Dispose points
      if (measurement.pointObjects) {
        measurement.pointObjects.forEach(point => {
          point.geometry.dispose();
          if (Array.isArray(point.material)) {
            point.material.forEach(m => m.dispose());
          } else {
            point.material.dispose();
          }
          measurementGroupRef.current?.remove(point);
        });
      }
      
      // Dispose area mesh
      if (measurement.areaObject) {
        measurement.areaObject.geometry.dispose();
        if (Array.isArray(measurement.areaObject.material)) {
          measurement.areaObject.material.forEach(m => m.dispose());
        } else {
          measurement.areaObject.material.dispose();
        }
        measurementGroupRef.current.remove(measurement.areaObject);
      }
    });
    
    // Clear measurements state
    setMeasurements([]);
    
    // Reset active tool
    setActiveTool('none');
    
    // Clear temporary points
    setTemporaryPoints([]);
    
    // Reset undo state
    setCanUndo(false);
  }, [measurements]);

  // Function to load a 3D model
  const loadModel = useCallback(async (file: File): Promise<void> => {
    if (!sceneRef.current) return Promise.reject('Scene not initialized');
    
    // Initialize loading state
    setState(prev => ({ ...prev, isLoading: true, progress: 0, error: null }));
    uploadProgressRef.current = 0;
    
    try {
      // Start a timer to track processing time
      processingStartTimeRef.current = Date.now();
      
      // Load the model
      const loadedModelData = await loadGLBModel(file, (progressEvent) => {
        // Calculate progress percentage
        const progressPercentage = progressEvent.lengthComputable ? 
          Math.round((progressEvent.loaded / progressEvent.total) * 100) : 0;
          
        // Update progress state with a number value (percentage)
        setState(prev => ({ ...prev, progress: progressPercentage }));
        uploadProgressRef.current = progressPercentage;
      });
      
      // If there's an existing model, remove it
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
      }
      
      if (!loadedModelData) {
        throw new Error('Failed to load model');
      }
      
      // Add model to scene
      sceneRef.current.add(loadedModelData);
      modelRef.current = loadedModelData;
      
      // Center the model
      const boundingBox = centerModel(loadedModelData);
      
      // Reset camera and controls
      resetView();
      
      // Update state
      setState(prev => ({
        ...prev,
        isLoading: false,
        progress: 100,
        loadedModel: loadedModelData
      }));
      
      // Show a success toast
      toast({
        title: "Modell geladen",
        description: "Das 3D-Modell wurde erfolgreich geladen.",
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error loading model:', error);
      
      // Update error state
      setState(prev => ({
        ...prev,
        isLoading: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Failed to load model'
      }));
      
      // Show an error toast
      toast({
        title: "Fehler beim Laden",
        description: "Das 3D-Modell konnte nicht geladen werden.",
        variant: "destructive",
      });
      
      return Promise.reject(error);
    }
  }, [toast]);

  // Function to reset the camera view
  const resetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current || !modelRef.current) return;
    
    // Reset camera position
    cameraRef.current.position.set(0, 2, 5);
    
    // Reset camera target
    controlsRef.current.target.set(0, 0, 0);
    
    // Update controls
    controlsRef.current.update();
  }, []);

  // Function to take a screenshot
  const takeScreenshot = useCallback(() => {
    if (!rendererRef.current) return;
    
    try {
      // Render the scene
      if (sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      // Get image data URL
      const imageURL = rendererRef.current.domElement.toDataURL('image/png');
      
      // Create download link
      const link = document.createElement('a');
      link.href = imageURL;
      link.download = `drohnenaufmass-${new Date().toISOString().split('T')[0]}.png`;
      
      // Trigger download
      link.click();
      
      // Show success toast
      toast({
        title: "Screenshot erstellt",
        description: "Der Screenshot wurde erfolgreich erstellt.",
      });
    } catch (error) {
      console.error('Error taking screenshot:', error);
      
      // Show error toast
      toast({
        title: "Fehler beim Screenshot",
        description: "Der Screenshot konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
  }, [toast]);

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
    updateMeasurementPointPosition,
    updatePreviewLine
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

  // Update canUndo state whenever temporaryPoints changes
  useEffect(() => {
    setCanUndo(temporaryPoints.length > 0);
  }, [temporaryPoints]);

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
