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

  // Helper to show real-time preview of measurement
  const updatePreviewLine = useCallback((startPoint: THREE.Vector3, endPoint: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    // Remove any existing preview line
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
    
    const material = createTemporaryLineMaterial();
    let linePoints: THREE.Vector3[];
    
    if (activeTool === 'height') {
      // For height measurement, create a vertical line
      const verticalPoint = new THREE.Vector3(
        startPoint.x,
        endPoint.y,
        startPoint.z
      );
      linePoints = [startPoint, verticalPoint, endPoint];
    } else if (activeTool === 'area' && temporaryPoints.length > 1) {
      // For area, connect all points including current hover point to form a polygon
      linePoints = [
        ...temporaryPoints.map(p => p.position),
        endPoint,
        temporaryPoints[0].position // Close the loop
      ];
    } else {
      // For length measurement, create a straight line
      linePoints = [startPoint, endPoint];
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    
    // Add preview line to scene
    measurementGroupRef.current.add(line);
    previewLineRef.current = line;
  }, [activeTool, temporaryPoints]);

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
          } else if (measurement.type === 'height') {
            newValue = calculateHeight(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          } else if (measurement.type === 'area') {
            // Calculate area for polygon
            newValue = calculateArea(updatedPoints.map(p => p.position));
            
            // Update area mesh if it exists
            if (measurement.areaObject && measurementGroupRef.current) {
              const positions = updatedPoints.map(p => p.position);
              const shape = new THREE.Shape();
              
              // Create shape from points
              shape.moveTo(positions[0].x, positions[0].z);
              for (let i = 1; i < positions.length; i++) {
                shape.lineTo(positions[i].x, positions[i].z);
              }
              shape.closePath();
              
              // Create new geometry from shape
              const geometry = new THREE.ShapeGeometry(shape);
              
              // Transform vertices to match 3D space (XZ plane projection)
              const positionAttribute = geometry.getAttribute('position');
              for (let i = 0; i < positionAttribute.count; i++) {
                const y = positions[0].y; // Use Y of first point
                const x = positionAttribute.getX(i);
                const z = positionAttribute.getY(i);
                positionAttribute.setXYZ(i, x, y, z);
              }
              geometry.computeVertexNormals();
              
              // Update area mesh geometry
              measurement.areaObject.geometry.dispose();
              measurement.areaObject.geometry = geometry;
            }
          }
          
          // Update label position and text
          if (measurement.labelObject) {
            // Update label position
            let labelPosition: THREE.Vector3;
            
            if (measurement.type === 'length') {
              labelPosition = new THREE.Vector3().addVectors(
                updatedPoints[0].position,
                updatedPoints[1].position
              ).multiplyScalar(0.5);
              labelPosition.y += 0.1; // Slightly above the line
            } else if (measurement.type === 'height') {
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
            } else { // area
              // Calculate centroid for polygon
              const positions = updatedPoints.map(p => p.position);
              let sumX = 0, sumY = 0, sumZ = 0;
              positions.forEach(p => {
                sumX += p.x;
                sumY += p.y;
                sumZ += p.z;
              });
              
              labelPosition = new THREE.Vector3(
                sumX / positions.length,
                sumY / positions.length,
                sumZ / positions.length
              );
              labelPosition.y += 0.1; // Slightly above the area
            }
            
            // Update sprite position
            measurement.labelObject.position.copy(labelPosition);
            
            // Update text
            const unit = measurement.type === 'area' ? 'm²' : 'm';
            const labelText = `${newValue.toFixed(2)} ${unit}`;
            
            // We need to recreate the sprite with updated text
            const newSprite = createTextSprite(
              labelText, 
              labelPosition
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
              } else if (measurement.type === 'height') {
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
              } else if (measurement.type === 'area') {
                // For area, update all lines to form polygon
                const positions = updatedPoints.map(p => p.position);
                
                for (let i = 0; i < positions.length; i++) {
                  const nextIndex = (i + 1) % positions.length;
                  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    positions[i],
                    positions[nextIndex]
                  ]);
                  
                  if (measurement.lineObjects[i]) {
                    measurement.lineObjects[i].geometry.dispose();
                    measurement.lineObjects[i].geometry = lineGeometry;
                  }
                }
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
      
      if (measurementToDelete.areaObject) {
        measurementToDelete.areaObject.geometry.dispose();
        (measurementToDelete.areaObject.material as THREE.Material).dispose();
        measurementGroupRef.current.remove(measurementToDelete.areaObject);
      }
      
      setMeasurements(prev => prev.filter(m => m.id !== id));
    }
  };

  useEffect(() => {
    if (hoverPoint && measurementGroupRef.current && activeTool !== 'none') {
      // Clear existing hover point
      const existingHoverPoint = measurementGroupRef.current.children.find(
        child => child.name === 'hoverPoint'
      );
      if (existingHoverPoint) {
        measurementGroupRef.current.remove(existingHoverPoint);
      }
      
      // Create new hover point indicator
      const hoverGeometry = new THREE.SphereGeometry(0.03);
      const hoverMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x1e88e5,
        transparent: true,
        opacity: 0.7
      });
      const hoverMesh = new THREE.Mesh(hoverGeometry, hoverMaterial);
      hoverMesh.position.copy(hoverPoint);
      hoverMesh.name = 'hoverPoint';
      measurementGroupRef.current.add(hoverMesh);
      
      previewPointRef.current = hoverMesh;
    } else if (!hoverPoint && previewPointRef.current && measurementGroupRef.current) {
      measurementGroupRef.current.remove(previewPointRef.current);
      previewPointRef.current.geometry.dispose();
      previewPointRef.current.material.dispose();
      previewPointRef.current = null;
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
    
    // Add mouse event listeners for dragging points
    containerRef.current.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', handleMouseDown);
      }
      window.removeEventListener('mouseup', handleMouseUp);
      
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

  const handleMeasurementClick = (event: MouseEvent) => {
    // Skip if we're currently dragging a point
    if (isDraggingPoint) return;
    
    if (activeTool === 'none' || !modelRef.current || !containerRef.current || 
        !sceneRef.current || !cameraRef.current) {
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
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
      
      // For length and height measurements, complete after two points
      if ((activeTool === 'length' || activeTool === 'height') && temporaryPoints.length === 1) {
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        finalizeMeasurement(newPoints);
      }
      // For area measurements, require at least 3 points
      else if (activeTool === 'area' && temporaryPoints.length >= 2) {
        // If this is double-clicking near the first point, complete the area
        if (temporaryPoints.length >= 3) {
          const firstPoint = temporaryPoints[0].position;
          // Check if the new point is close to the first point to close the polygon
          if (point.distanceTo(firstPoint) < 0.2) {
            // Remove the last point (current click) and use the first point to close the polygon
            const newPoints = [...temporaryPoints];
            finalizeMeasurement(newPoints);
            
            // Clean up the preview line
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
            return;
          }
        }
      }
    }
  };
  
  const addMeasurementPoint = (position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    // Create point
    const pointGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const pointMaterial = createDraggablePointMaterial();
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.copy(position);
    
    // Set a unique name for the point
    point.name = `point-temp-${temporaryPoints.length}`;
    
    measurementGroupRef.current.add(point);
    
    if (!currentMeasurementRef.current) {
      currentMeasurementRef
