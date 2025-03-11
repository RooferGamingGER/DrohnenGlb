import { useState, useEffect, useRef } from 'react';
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
  createMeasurementId,
  createTextSprite,
  updateLabelScale,
  createDraggablePointMaterial
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
    backgroundOptions.find(bg => bg.id === 'dark') || backgroundOptions[0]
  );
  
  const [activeTool, setActiveTool] = useState<MeasurementType>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [temporaryPoints, setTemporaryPoints] = useState<MeasurementPoint[]>([]);

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
  } | null>(null);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  
  const handleMouseMove = (event: MouseEvent | TouchEvent) => {
    if (!containerRef.current) return;
    
    let clientX: number, clientY: number;
    
    if ('touches' in event) {
      // Touch event
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      
      // Prevent scrolling while dragging
      if (isDraggingPoint) {
        event.preventDefault();
      }
    } else {
      // Mouse event
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    // Update mouse position
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
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
    else if ((activeTool === 'length' || activeTool === 'height') && modelRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        setHoverPoint(intersects[0].point.clone());
      } else {
        setHoverPoint(null);
      }
    }
    // Check if we're hovering over any measurement points
    else if ((activeTool === 'none' || activeTool === 'move') && measurementGroupRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // Filter for meshes only (points)
      const pointObjects = measurementGroupRef.current.children.filter(
        child => child instanceof THREE.Mesh && child.name.startsWith('point-')
      );
      
      const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
      
      if (intersects.length > 0) {
        const pointId = intersects[0].object.name;
        setHoveredPointId(pointId);
        
        // Use specific cursor for move tool
        if (activeTool === 'move') {
          document.body.style.cursor = 'grab';
        } else {
          document.body.style.cursor = 'pointer';
        }
        
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

  const handleMouseDown = (event: MouseEvent | TouchEvent) => {
    if (!containerRef.current || !measurementGroupRef.current) return;
    
    // For touch events, prevent default to avoid scrolling
    if ('touches' in event && event.touches.length > 0) {
      // Update mouse position for touch
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
      
      // Prevent default to avoid scrolling while interacting with measurements
      event.preventDefault();
    }
    
    // Check if we're clicking on a measurement point while using the move tool
    if (hoveredPointId && (activeTool === 'move' || activeTool === 'none')) {
      // Prevent event propagation to stop orbit controls from activating
      event.preventDefault();
      if ('stopPropagation' in event) event.stopPropagation();
      
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
          
          // Highlight the selected measurement
          setMeasurements(prev => prev.map(m => ({
            ...m,
            isActive: m.id === measurementId
          })));
          
          // Disable orbit controls while dragging
          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
          
          // Show toast notification for user feedback
          if (activeTool === 'move') {
            toast({
              title: "Messpunkt wird verschoben",
              description: "Bewegen Sie den Cursor und klicken Sie erneut, um den Punkt zu platzieren",
              duration: 2000,
            });
          }
        }
      }
    }
  };

  const handleMouseUp = (event: MouseEvent | TouchEvent) => {
    if (isDraggingPoint) {
      // Finish dragging
      setIsDraggingPoint(false);
      draggedPointRef.current = null;
      document.body.style.cursor = hoveredPointId ? 'grab' : 'auto';
      
      // Re-enable orbit controls
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      
      // Reset active measurements
      setMeasurements(prev => prev.map(m => ({
        ...m,
        isActive: false
      })));
      
      // Clear selection
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
      
      // If we are in move mode, show confirmation
      if (activeTool === 'move') {
        toast({
          title: "Messpunkt verschoben",
          description: "Der Messpunkt wurde erfolgreich neu positioniert",
          duration: 2000,
        });
      }
    }
  };

  const updateMeasurementPointPosition = (
    measurementId: string,
    pointIndex: number,
    newPosition: THREE.Vector3
  ) => {
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(measurement => {
        if (measurement.id === measurementId) {
          // Create a copy of points with updated position
          const updatedPoints = [...measurement.points];
          
          if (updatedPoints[pointIndex]) {
            updatedPoints[pointIndex] = {
              ...updatedPoints[pointIndex],
              position: newPosition,
              worldPosition: newPosition.clone()
            };
          }
          
          // Calculate new measurement value
          let newValue: number;
          if (measurement.type === 'length') {
            newValue = calculateDistance(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          } else { // height
            newValue = calculateHeight(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          }
          
          // Update label position and text
          if (measurement.labelObject) {
            // Update label position (middle point)
            let labelPosition: THREE.Vector3;
            
            if (measurement.type === 'length') {
              labelPosition = new THREE.Vector3().addVectors(
                updatedPoints[0].position,
                updatedPoints[1].position
              ).multiplyScalar(0.5);
              labelPosition.y += 0.1; // Slightly above the line
            } else { // height
              const midHeight = (
                updatedPoints[0].position.y + 
                updatedPoints[1].position.y
              ) / 2;
              
              labelPosition = new THREE.Vector3(
                updatedPoints[0].position.x,
                midHeight,
                updatedPoints[0].position.z
              );
              labelPosition.x += 0.1; // Slightly to the right
            }
            
            // Update sprite position
            measurement.labelObject.position.copy(labelPosition);
            
            // Update text
            const labelText = `${newValue.toFixed(2)} ${measurement.unit}`;
            
            // We need to recreate the sprite with updated text
            const newSprite = createTextSprite(
              labelText, 
              labelPosition,
              measurement.type === 'length' ? 0x00ff00 : 0x0000ff
            );
            
            // Copy user data and scale
            newSprite.userData = measurement.labelObject.userData;
            newSprite.scale.copy(measurement.labelObject.scale);
            
            // Remove old sprite and add new one
            if (measurementGroupRef.current) {
              // Dispose old sprite materials
              if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
                measurement.labelObject.material.map?.dispose();
                measurement.labelObject.material.dispose();
              }
              
              measurementGroupRef.current.remove(measurement.labelObject);
              measurementGroupRef.current.add(newSprite);
            }
            
            // Update line positions
            if (measurement.lineObjects && measurement.lineObjects.length > 0) {
              if (measurement.type === 'length') {
                // For length, just update the start and end points
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                  updatedPoints[0].position,
                  updatedPoints[1].position
                ]);
                
                measurement.lineObjects[0].geometry.dispose();
                measurement.lineObjects[0].geometry = lineGeometry;
              } else { // height
                // For height, we have a vertical line
                const verticalPoint = new THREE.Vector3(
                  updatedPoints[0].position.x,
                  updatedPoints[1].position.y,
                  updatedPoints[0].position.z
                );
                
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                  updatedPoints[0].position,
                  verticalPoint,
                  updatedPoints[1].position
                ]);
                
                measurement.lineObjects[0].geometry.dispose();
                measurement.lineObjects[0].geometry = lineGeometry;
              }
            }
            
            return {
              ...measurement,
              points: updatedPoints,
              value: newValue,
              labelObject: newSprite
            };
          }
          
          return {
            ...measurement,
            points: updatedPoints,
            value: newValue
          };
        }
        return measurement;
      });
    });
  };

  const undoLastPoint = () => {
    if (temporaryPoints.length > 0) {
      const newPoints = temporaryPoints.slice(0, -1);
      setTemporaryPoints(newPoints);
      
      if (measurementGroupRef.current) {
        const lastPoint = measurementGroupRef.current.children.find(
          child => child instanceof THREE.Mesh && 
          child.position.equals(temporaryPoints[temporaryPoints.length - 1].position)
        );
        if (lastPoint) measurementGroupRef.current.remove(lastPoint);
        
        if (currentMeasurementRef.current?.lines.length) {
          const lastLine = currentMeasurementRef.current.lines[currentMeasurementRef.current.lines.length - 1];
          measurementGroupRef.current.remove(lastLine);
          currentMeasurementRef.current.lines.pop();
        }
        
        if (currentMeasurementRef.current?.labels.length) {
          const lastLabel = currentMeasurementRef.current.labels[currentMeasurementRef.current.labels.length - 1];
          measurementGroupRef.current.remove(lastLabel);
          currentMeasurementRef.current.labels.pop();
        }
      }
    }
  };

  const deleteMeasurement = (id: string) => {
    const measurementToDelete = measurements.find(m => m.id === id);
    if (measurementToDelete && measurementGroupRef.current) {
      if (measurementToDelete.labelObject) {
        if (measurementToDelete.labelObject.material instanceof THREE.SpriteMaterial) {
          measurementToDelete.labelObject.material.map?.dispose();
          measurementToDelete.labelObject.material.dispose();
        }
        measurementGroupRef.current.remove(measurementToDelete.labelObject);
      }
      
      if (measurementToDelete.lineObjects) {
        measurementToDelete.lineObjects.forEach(line => {
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(line);
        });
      }
      
      if (measurementToDelete.pointObjects) {
        measurementToDelete.pointObjects.forEach(point => {
          point.geometry.dispose();
          (point.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(point);
        });
      }
      
      setMeasurements(prev => prev.filter(m => m.id !== id));
    }
  };

  useEffect(() => {
    if (hoverPoint && measurementGroupRef.current && activeTool !== 'none') {
      const hoverGeometry = new THREE.SphereGeometry(0.03);
      const hoverMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.5
      });
      const hoverMesh = new THREE.Mesh(hoverGeometry, hoverMaterial);
      hoverMesh.position.copy(hoverPoint);
      hoverMesh.name = 'hoverPoint';
      
      const existingHoverPoint = measurementGroupRef.current.children.find(
        child => child.name === 'hoverPoint'
      );
      if (existingHoverPoint) {
        measurementGroupRef.current.remove(existingHoverPoint);
      }
      
      measurementGroupRef.current.add(hoverMesh);
    }
  }, [hoverPoint, activeTool]);

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
    
    // Explicitly add event listeners to the container for measurement point interaction
    // These need to run before the orbit controls get the events
    containerRef.current.addEventListener('mousedown', handleMouseDown, { capture: true });
    containerRef.current.addEventListener('touchstart', handleMouseDown, { passive: false, capture: true });
    
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', handleMouseDown, { capture: true });
        containerRef.current.removeEventListener('touchstart', handleMouseDown, { capture: true });
      }
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      
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

  const handleMeasurementClick = (event: MouseEvent | TouchEvent) => {
    // Skip if we're currently dragging a point or if we're clicking on a measurement point
    // or if we're in move mode (since move mode has its own handling)
    if (isDraggingPoint || hoveredPointId || activeTool === 'move') return;
    
    if (activeTool === 'none' || !modelRef.current || !containerRef.current || 
        !sceneRef.current || !cameraRef.current) {
      return;
    }
    
    let clientX: number, clientY: number;
    
    if ('touches' in event) {
      // Touch event
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      // Mouse event
      clientX = (event as MouseEvent).clientX;
      clientY = (event as MouseEvent).clientY;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      const worldPoint = point.clone();
      
      setTemporaryPoints(prev => [...prev, { 
        position: point,
        worldPosition: worldPoint
      }]);
      
      addMeasurementPoint(point);
      
      if ((activeTool === 'length' || activeTool === 'height') && temporaryPoints.length === 1) {
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        finalizeMeasurement(newPoints);
      }
    }
  };
  
  const addMeasurementPoint = (position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    const pointGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const pointMaterial = createDraggablePointMaterial();
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.copy(position);
    
    // Set a unique name for the point so we can identify it later when dragging
    // The name will be updated with the measurement ID after finalization
    point.name = `point-temp-${temporaryPoints.length}`;
    
    measurementGroupRef.current.add(point);
    
    if (!currentMeasurementRef.current) {
      currentMeasurementRef.current = {
        points: [position],
        lines: [],
        labels: [],
        meshes: [point]
      };
    } else {
      currentMeasurementRef.current.points.push(position);
      currentMeasurementRef.current.meshes.push(point);
    }
    
    if (temporaryPoints.length > 0) {
      const prevPoint = temporaryPoints[temporaryPoints.length - 1].position;
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: activeTool === 'length' ? 0x00ff00 : 0x0000ff,
        linewidth: 2
      });
      
      let linePoints: THREE.Vector3[];
      
      if (activeTool === 'height') {
        const verticalPoint = new THREE.Vector3(
          prevPoint.x, 
          position.y,
          prevPoint.z
        );
        
        linePoints = [prevPoint, verticalPoint, position];
      } else {
        linePoints = [prevPoint, position];
      }
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      measurementGroupRef.current.add(line);
      
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current.lines.push(line);
      }
      
      if (activeTool === 'length' || activeTool === 'height') {
        let value: number;
        let unit = 'm';
        
        if (activeTool === 'length') {
          value = calculateDistance(prevPoint, position);
          
          const midPoint = new THREE.Vector3().addVectors(prevPoint, position).multiplyScalar(0.5);
          midPoint.y += 0.1;
          
          const labelText = `${value.toFixed(2)} ${unit}`;
          const labelSprite = createTextSprite(labelText, midPoint, 0x00ff00);
          
          // Make sure new sprites are correctly initialized for dynamic scaling
          labelSprite.userData = {
            ...labelSprite.userData,
            isLabel: true,
            baseScale: { x: 0.8, y: 0.4, z: 1 }
          };
          
          if (cameraRef.current) {
            updateLabelScale(labelSprite, cameraRef.current);
          }
          
          measurementGroupRef.current.add(labelSprite);
          
          if (currentMeasurementRef.current) {
            currentMeasurementRef.current.labels.push(labelSprite);
          }
        } else {
          value = calculateHeight(prevPoint, position);
          
          const midHeight = (prevPoint.y + position.y) / 2;
          const midPoint = new THREE.Vector3(
            prevPoint.x,
            midHeight,
            prevPoint.z
          );
          midPoint.x += 0.1;
          
          const labelText = `${value.toFixed(2)} ${unit}`;
          const labelSprite = createTextSprite(labelText, midPoint, 0x0000ff);
          
          // Make sure new sprites are correctly initialized for dynamic scaling
          labelSprite.userData = {
            ...labelSprite.userData,
            isLabel: true,
            baseScale: { x: 0.8, y: 0.4, z: 1 }
          };
          
          if (cameraRef.current) {
            updateLabelScale(labelSprite, cameraRef.current);
          }
          
          measurementGroupRef.current.add(labelSprite);
          
          if (currentMeasurementRef.current) {
            currentMeasurementRef.current.labels.push(labelSprite);
          }
        }
      }
    }
  };
  
  const finalizeMeasurement = (points: MeasurementPoint[]) => {
    if (activeTool === 'none' || points.length < 2) return;
    
    let value = 0;
    let unit = 'm';
    
    if (activeTool === 'length') {
      value = calculateDistance(points[0].position, points[1].position);
    } else if (activeTool === 'height') {
      value = calculateHeight(points[0].position, points[1].position);
    }
    
    const measurementId = createMeasurementId();
    
    // Update point names with the new measurement ID for easy identification
    if (currentMeasurementRef.current && currentMeasurementRef.current.meshes) {
      currentMeasurementRef.current.meshes.forEach((mesh, index) => {
        mesh.name = `point-${measurementId}-${index}`;
      });
    }
    
    const measurementObjects = {
      pointObjects: currentMeasurementRef.current?.meshes || [],
      lineObjects: currentMeasurementRef.current?.lines || [],
      labelObject: currentMeasurementRef.current?.labels[0] || null
    };
    
    const newMeasurement: Measurement = {
      id: measurementId,
      type: activeTool,
      points: points,
      value,
      unit,
      ...measurementObjects
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    setTemporaryPoints([]);
    
    currentMeasurementRef.current = null;
  };
  
  const clearMeasurements = () => {
    if (measurementGroupRef.current) {
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
      });
      
      const hoverPoint = measurementGroupRef.current.children.find(
        child => child.name === 'hoverPoint'
      );
      if (hoverPoint) {
        measurementGroupRef.current.remove(hoverPoint);
      }
    }
    
    setMeasurements([]);
    setTemporaryPoints([]);
    currentMeasurementRef.current = null;
  };

  const updateMeasurement = (id: string, data: Partial<Measurement>) => {
    setMeasurements(prevMeasurements => 
      prevMeasurements.map(m => 
        m.id === id ? { ...m, ...data } : m
      )
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Only add measurement click handlers for length and height tools
    if (activeTool === 'length' || activeTool === 'height') {
      containerRef.current.addEventListener('click', handleMeasurementClick);
      containerRef.current.addEventListener('touchend', handleMeasurementClick, { passive: false });
      
      if (controlsRef.current) {
        // Disable rotation for measurement tools
        controlsRef.current.enableRotate = false;
      }
    } else {
      containerRef.current.removeEventListener('click', handleMeasurementClick);
      containerRef.current.removeEventListener('touchend', handleMeasurementClick);
      setTemporaryPoints([]);
      
      if (controlsRef.current) {
        // Enable orbit controls for navigation and move tool
        controlsRef.current.enableRotate = activeTool !== 'move';
      }
      
      // For move tool, highlight measurement points
      if (activeTool === 'move' && measurementGroupRef.current) {
        // Make all measurement points more visible in move mode
        measurementGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.name.startsWith('point-')) {
            child.scale.set(1.3, 1.3, 1.3); // Make points larger
          }
        });
      } else if (measurementGroupRef.current) {
        // Reset point sizes in other modes
        measurementGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.name.startsWith('point-')) {
            child.scale.set(1, 1, 1);
          }
        });
      }
    }
    
    return () => {
      containerRef.current?.removeEventListener('click', handleMeasurementClick);
      containerRef.current?.removeEventListener('touchend', handleMeasurementClick);
    };
  }, [activeTool, temporaryPoints]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('touchmove', handleMouseMove, { passive: false });
    
    return () => {
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('touchmove', handleMouseMove);
    };
  }, [activeTool, temporaryPoints, isDraggingPoint, hoveredPointId]);

  useEffect(() => {
    setCanUndo(temporaryPoints.length > 0);
  }, [temporaryPoints]);

  const loadModel = async (file: File) => {
    try {
      if (!sceneRef.current) return;

      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
      }

      clearMeasurements();

      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }

      setState({
        isLoading: true,
        progress: 0,
        error: null,
        loadedModel: null,
      });

      uploadProgressRef.current = 0;

      const model = await loadGLBModel(
        file,
        (event) => {
          if (event.lengthComputable) {
            const uploadPercentage = Math.round((event.loaded / event.total) * 100);
            uploadProgressRef.current = uploadPercentage;
            const scaledProgress = Math.floor(uploadPercentage * 0.7);
            setState(prev => ({ ...prev, progress: scaledProgress }));
          }
        }
      );

      setState(prev => ({ ...prev, progress: 70 }));
      processingStartTimeRef.current = Date.now();
      
      const estimatedProcessingTime = 3000;
      
      processingIntervalRef.current = window.setInterval(() => {
        const elapsedTime = Date.now() - (processingStartTimeRef.current || 0);
        const processingProgress = Math.min(
          Math.floor(70 + (elapsedTime / estimatedProcessingTime) * 30), 
          99
        );
        
        setState(prev => ({ ...prev, progress: processingProgress }));
        
        if (processingProgress >= 99) {
          if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current);
            processingIntervalRef.current = null;
          }
        }
      }, 100);

      const box = centerModel(model);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());

      model.rotation.x = -Math.PI / 2;

      if (cameraRef.current && controlsRef.current) {
        const distance = size * 1.5;
        
        cameraRef.current.position.set(0, 0, 0);
        cameraRef.current.position.copy(center);
        cameraRef.current.position.z += distance;
        cameraRef.current.lookAt(center);

        controlsRef.current.target.copy(center);
        controlsRef.current.update();
        controlsRef.current.saveState();
      }

      sceneRef.current.add(model);
      modelRef.current = model;

      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }

      setState({
        isLoading: false,
        progress: 100,
        error: null,
        loadedModel: model,
      });

      applyBackground(backgroundOptions.find(bg => bg.id === 'dark') || backgroundOptions[0]);

      return model;
    } catch (error) {
      console.error('Error loading model:', error);
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
      
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
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      
      const distance = size * 1.5;
      cameraRef.current.position.copy(center);
      cameraRef.current.position.z += distance;
      cameraRef.current.lookAt(center);
      
      controlsRef.current.target.copy(center);
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
    activeTool,
    setActiveTool,
    measurements,
    clearMeasurements,
    undoLastPoint,
    deleteMeasurement,
    updateMeasurement,
    canUndo,
  };
};
