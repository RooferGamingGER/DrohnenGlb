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
  calculateInclination,
  calculatePolygonArea,
  createMeasurementId,
  createTextSprite,
  updateLabelScale,
  createDraggablePointMaterial,
  createEditablePointMaterial,
  createDraggablePoint,
  createMeasurementLine,
  isDoubleClick,
  togglePointSelection,
  isPointSelected,
  formatMeasurementWithInclination,
  isInclinationSignificant
} from '@/utils/measurementUtils';
import { useToast } from '@/hooks/use-toast';

interface UseModelViewerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadComplete?: () => void;
}

interface ModelViewerState {
  isLoading: boolean;
  progress: number;
  error: string | null;
  loadedModel: THREE.Group | null;
}

export const useModelViewer = ({ containerRef, onLoadComplete }: UseModelViewerProps) => {
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
  const lastClickTimeRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);

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
  const loadStartTimeRef = useRef<number | null>(null);
  const modelSizeRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);
  
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

  const touchStartPositionRef = useRef<{x: number, y: number} | null>(null);
  const isTouchMoveRef = useRef<boolean>(false);
  const touchStartTimeRef = useRef<number>(0);
  const touchIdentifierRef = useRef<number | null>(null);
  const pinchDistanceStartRef = useRef<number | null>(null);
  const isPinchingRef = useRef<boolean>(false);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  
  const handleMouseMove = (event: MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (isDraggingPoint && draggedPointRef.current && modelRef.current && cameraRef.current) {
      event.preventDefault();
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        const newPosition = intersects[0].point.clone();
        
        draggedPointRef.current.position.copy(newPosition);
        
        if (selectedMeasurementId !== null && selectedPointIndex !== null) {
          updateMeasurementPointPosition(
            selectedMeasurementId, 
            selectedPointIndex, 
            newPosition
          );
        }
      }
    } else if (activeTool !== 'none' && modelRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        setHoverPoint(intersects[0].point.clone());
      } else {
        setHoverPoint(null);
      }
    } else if (activeTool === 'none' && measurementGroupRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const pointObjects = measurementGroupRef.current.children.filter(
        child => child instanceof THREE.Mesh && child.name.startsWith('point-')
      );
      
      const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
      
      if (intersects.length > 0) {
        const pointId = intersects[0].object.name;
        setHoveredPointId(pointId);
        document.body.style.cursor = 'pointer';
        
        if (intersects[0].object instanceof THREE.Mesh) {
          const nameParts = pointId.split('-');
          if (nameParts.length >= 3) {
            const measurementId = nameParts[1];
            const measurement = measurements.find(m => m.id === measurementId);
            
            if (!measurement?.editMode) {
              intersects[0].object.material = createDraggablePointMaterial(true);
            } else {
              intersects[0].object.material = createEditablePointMaterial(false);
            }
          } else {
            intersects[0].object.material = createDraggablePointMaterial(true);
          }
        }
      } else {
        if (hoveredPointId) {
          const prevHoveredPoint = measurementGroupRef.current.children.find(
            child => child.name === hoveredPointId
          );
          
          if (prevHoveredPoint && prevHoveredPoint instanceof THREE.Mesh) {
            const nameParts = hoveredPointId.split('-');
            if (nameParts.length >= 3) {
              const measurementId = nameParts[1];
              const measurement = measurements.find(m => m.id === measurementId);
              
              if (measurement?.editMode) {
                prevHoveredPoint.material = createEditablePointMaterial(false);
              } else {
                prevHoveredPoint.material = createDraggablePointMaterial(false);
              }
            } else {
              prevHoveredPoint.material = createDraggablePointMaterial(false);
            }
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
    
    previousMouseRef.current.copy(mouseRef.current);
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!containerRef.current || !measurementGroupRef.current) return;
    
    if (hoveredPointId && !isDraggingPoint) {
      const nameParts = hoveredPointId.split('-');
      if (nameParts.length >= 3) {
        const measurementId = nameParts[1];
        const measurement = measurements.find(m => m.id === measurementId);
        
        if (measurement?.editMode) {
          const pointIndex = parseInt(nameParts[2], 10);
          const pointMesh = measurementGroupRef.current.children.find(
            child => child.name === hoveredPointId
          ) as THREE.Mesh;
          
          if (pointMesh) {
            event.preventDefault();
            event.stopPropagation();
            
            setIsDraggingPoint(true);
            draggedPointRef.current = pointMesh;
            document.body.style.cursor = 'grabbing';
            
            setSelectedMeasurementId(measurementId);
            setSelectedPointIndex(pointIndex);
            
            if (controlsRef.current) {
              controlsRef.current.enabled = false;
            }
            
            pointMesh.userData = {
              ...pointMesh.userData,
              isBeingDragged: true
            };
            
            toast({
              title: "Punkt wird verschoben",
              description: "Bewegen Sie den Punkt an die gewünschte Position.",
              duration: 3000,
            });
            
            return;
          }
        }
      }
      
      const currentTime = new Date().getTime();
      const pointMesh = measurementGroupRef.current.children.find(
        child => child.name === hoveredPointId
      ) as THREE.Mesh;
      
      if (pointMesh && pointMesh.userData) {
        const lastClickTime = pointMesh.userData.lastClickTime || 0;
        
        if (isDoubleClick(currentTime, lastClickTime)) {
          event.preventDefault();
          event.stopPropagation();
          
          if (isPointSelected(pointMesh)) {
            togglePointSelection(pointMesh);
            
            if (controlsRef.current && controlsRef.current.enabled === false) {
              controlsRef.current.enabled = true;
            }
            
            toast({
              title: "Punkt deaktiviert",
              description: "Der Messpunkt wurde deaktiviert.",
              duration: 3000,
            });
            
            setIsDraggingPoint(false);
            draggedPointRef.current = null;
            setSelectedMeasurementId(null);
            setSelectedPointIndex(null);
          } else {
            setIsDraggingPoint(true);
            draggedPointRef.current = pointMesh;
            document.body.style.cursor = 'grabbing';
            
            togglePointSelection(pointMesh);
            
            const nameParts = hoveredPointId.split('-');
            if (nameParts.length >= 3) {
              const measurementId = nameParts[1];
              const pointIndex = parseInt(nameParts[2], 10);
              
              setSelectedMeasurementId(measurementId);
              setSelectedPointIndex(pointIndex);
              
              if (controlsRef.current) {
                controlsRef.current.enabled = false;
              }
              
              pointMesh.userData.isBeingDragged = true;
              
              toast({
                title: "Punkt wird verschoben",
                description: "Bewegen Sie den Punkt an die gewünschte Position und lassen Sie die Maustaste los, oder klicken Sie doppelt, um ihn zu deaktivieren.",
                duration: 3000,
              });
            }
          }
        } else {
          pointMesh.userData.lastClickTime = currentTime;
        }
      }
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!containerRef.current) return;
    
    event.preventDefault();
    
    if (event.touches.length === 2) {
      isPinchingRef.current = true;
      
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      pinchDistanceStartRef.current = Math.sqrt(dx * dx + dy * dy);
      
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
      
      return;
    }
    
    isPinchingRef.current = false;
    
    if (event.touches.length !== 1 || !measurementGroupRef.current || !cameraRef.current) return;
    
    const touch = event.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const now = Date.now();
    
    touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY };
    touchIdentifierRef.current = touch.identifier;
    isTouchMoveRef.current = false;
    touchStartTimeRef.current = now;
    
    mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    const pointObjects = measurementGroupRef.current.children.filter(
      child => child instanceof THREE.Mesh && child.name.startsWith('point-')
    );
    
    const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
    
    if (intersects.length > 0) {
      const pointMesh = intersects[0].object as THREE.Mesh;
      const pointId = pointMesh.name;
      setHoveredPointId(pointId);
      
      const isDoubleTap = isDoubleClick(now, lastTouchTimeRef.current);
      lastTouchTimeRef.current = now;
      
      const nameParts = pointId.split('-');
      if (nameParts.length >= 3) {
        const measurementId = nameParts[1];
        const pointIndex = parseInt(nameParts[2], 10);
        const measurement = measurements.find(m => m.id === measurementId);
        
        if (measurement?.editMode || isDoubleTap) {
          setIsDraggingPoint(true);
          draggedPointRef.current = pointMesh;
          
          setSelectedMeasurementId(measurementId);
          setSelectedPointIndex(pointIndex);
          
          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
          
          pointMesh.userData.isBeingDragged = true;
          
          toast({
            title: "Punkt wird verschoben",
            description: "Bewegen Sie den Finger, um den Punkt zu verschieben, und tippen Sie dann, um ihn zu platzieren.",
            duration: 3000,
          });
        }
      }
    } else if (activeTool !== 'none' && modelRef.current) {
      const modelIntersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (modelIntersects.length > 0) {
        const touchPoint = modelIntersects[0].point.clone();
        setTimeout(() => {
          if (!isTouchMoveRef.current && 
              touchIdentifierRef.current === touch.identifier && 
              touchStartPositionRef.current && 
              Math.abs(touchStartPositionRef.current.x - touch.clientX) < 10 && 
              Math.abs(touchStartPositionRef.current.y - touch.clientY) < 10) {
            addMeasurementPointTouch(touchPoint);
          }
        }, 500);
      }
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!containerRef.current) return;
    
    event.preventDefault();
    
    if (isPinchingRef.current && event.touches.length === 2 && cameraRef.current && pinchDistanceStartRef.current) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const pinchDistance = Math.sqrt(dx * dx + dy * dy);
      
      const zoomDelta = (pinchDistance - pinchDistanceStartRef.current) * 0.01;
      
      const newZoom = cameraRef.current.position.z - zoomDelta;
      
      cameraRef.current.position.z = Math.max(2, Math.min(20, newZoom));
      
      pinchDistanceStartRef.current = pinchDistance;
      
      return;
    }
    
    if (event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    
    if (touchStartPositionRef.current) {
      const deltaX = Math.abs(touch.clientX - touchStartPositionRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPositionRef.current.y);
      
      if (deltaX > 10 || deltaY > 10) {
        isTouchMoveRef.current = true;
      }
    }
    
    if (isDraggingPoint && draggedPointRef.current && modelRef.current && cameraRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        const newPosition = intersects[0].point.clone();
        draggedPointRef.current.position.copy(newPosition);
        
        if (selectedMeasurementId !== null && selectedPointIndex !== null) {
          updateMeasurementPointPosition(
            selectedMeasurementId, 
            selectedPointIndex, 
            newPosition
          );
        }
      }
    } else if (isTouchMoveRef.current && controlsRef.current && touchStartPositionRef.current && activeTool === 'none' && !isPinchingRef.current) {
      if (controlsRef.current) {
        const deltaX = (touch.clientX - touchStartPositionRef.current.x) * 0.005;
        const deltaY = (touch.clientY - touchStartPositionRef.current.y) * 0.005;
        
        if (cameraRef.current) {
          const radius = cameraRef.current.position.distanceTo(controlsRef.current.target);
          
          controlsRef.current.update();
          
          cameraRef.current.position.y += deltaY * radius;
          
          const theta = Math.atan2(
            cameraRef.current.position.x - controlsRef.current.target.x,
            cameraRef.current.position.z - controlsRef.current.target.z
          );
          
          const newTheta = theta - deltaX;
          const x = controlsRef.current.target.x + radius * Math.sin(newTheta);
          const z = controlsRef.current.target.z + radius * Math.cos(newTheta);
          
          cameraRef.current.position.x = x;
          cameraRef.current.position.z = z;
          
          cameraRef.current.lookAt(controlsRef.current.target);
          
          controlsRef.current.update();
        }
      }
      
      touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      pinchDistanceStartRef.current = null;
      
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }
    
    if (isDraggingPoint) {
      setIsDraggingPoint(false);
      
      if (draggedPointRef.current?.userData) {
        draggedPointRef.current.userData.isBeingDragged = false;
      }
      
      draggedPointRef.current = null;
      
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      
      toast({
        title: "Position aktualisiert",
        description: "Die Messung wurde an die neue Position angepasst.",
        duration: 3000,
      });
      
      setIsDraggingPoint(false);
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
    } else if (!isTouchMoveRef.current && activeTool !== 'none' && modelRef.current && containerRef.current && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
      if (touchIdentifierRef.current === touch.identifier) {
        handleMeasurementTap(touch);
      }
    }
    
    touchStartPositionRef.current = null;
    isTouchMoveRef.current = false;
    touchIdentifierRef.current = null;
  };

  const addMeasurementPointTouch = (point: THREE.Vector3) => {
    if (activeTool === 'none') return;
    
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
    
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(50);
    }
    
    toast({
      title: "Messpunkt gesetzt",
      description: `Punkt ${temporaryPoints.length + 1} wurde platziert.`,
      duration: 2000,
    });
  };

  const updateMeasurementPointPosition = (
    measurementId: string,
    pointIndex: number,
    newPosition: THREE.Vector3
  ) => {
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(measurement => {
        if (measurement.id === measurementId) {
          const updatedPoints = [...measurement.points];
          
          if (updatedPoints[pointIndex]) {
            updatedPoints[pointIndex] = {
              ...updatedPoints[pointIndex],
              position: newPosition,
              worldPosition: newPosition.clone()
            };
          }
          
          let newValue: number;
          let inclination: number | undefined;
          
          if (measurement.type === 'length') {
            newValue = calculateDistance(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
            
            inclination = calculateInclination(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          } else {
            newValue = calculateHeight(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          }
          
          if (measurement.labelObject) {
            let labelPosition: THREE.Vector3;
            
            if (measurement.type === 'length') {
              labelPosition = new THREE.Vector3().addVectors(
                updatedPoints[0].position,
                updatedPoints[1].position
              ).multiplyScalar(0.5);
              labelPosition.y += 0.1;
            } else {
              const midHeight = (
                updatedPoints[0].position.y + 
                updatedPoints[1].position.y
              ) / 2;
              
              labelPosition = new THREE.Vector3(
                updatedPoints[0].position.x,
                midHeight,
                updatedPoints[0].position.z
              );
              labelPosition.x += 0.1;
            }
            
            measurement.labelObject.position.copy(labelPosition);
            
            const labelText = measurement.type === 'length' 
              ? formatMeasurementWithInclination(newValue, inclination)
              : `${newValue.toFixed(2)} ${measurement.unit}`;
            
            const newSprite = createTextSprite(
              labelText, 
              labelPosition,
              measurement.type === 'length' ? 0x00ff00 : 0x0000ff
            );
            
            newSprite.userData = measurement.labelObject.userData;
            newSprite.scale.copy(measurement.labelObject.scale);
            
            if (measurementGroupRef.current) {
              if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
                measurement.labelObject.material.map?.dispose();
                measurement.labelObject.material.dispose();
              }
              
              measurementGroupRef.current.remove(measurement.labelObject);
              measurementGroupRef.current.add(newSprite);
            }
            
            if (measurement.lineObjects && measurement.lineObjects.length > 0) {
              if (measurement.type === 'length') {
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                  updatedPoints[0].position,
                  updatedPoints[1].position
                ]);
                
                measurement.lineObjects[0].geometry.dispose();
                measurement.lineObjects[0].geometry = lineGeometry;
              } else {
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
              inclination: measurement.type === 'length' ? inclination : undefined,
              labelObject: newSprite
            };
          }
          
          return {
            ...measurement,
            points: updatedPoints,
            value: newValue,
            inclination: measurement.type === 'length' ? inclination : undefined
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
          if (measurementToDelete.labelObject.material.map) {
            measurementToDelete.labelObject.material.map.dispose();
          }
          measurementToDelete.labelObject.material.dispose();
        }
        measurementGroupRef.current.remove(measurementToDelete.labelObject);
      }
      
      if (measurementToDelete.lineObjects) {
        measurementToDelete.lineObjects.forEach(line => {
          if (line) {
            if (line.geometry) line.geometry.dispose();
            if (line.material instanceof THREE.Material) line.material.dispose();
            else if (Array.isArray(line.material)) {
              line.material.forEach(mat => mat.dispose());
            }
            measurementGroupRef.current?.remove(line);
          }
        });
      }
      
      if (measurementToDelete.pointObjects) {
        measurementToDelete.pointObjects.forEach(point => {
          if (point) {
            if (point.geometry) point.geometry.dispose();
            if (point.material instanceof THREE.Material) point.material.dispose();
            else if (Array.isArray(point.material)) {
              point.material.forEach(mat => mat.dispose());
            }
            measurementGroupRef.current?.remove(point);
          }
        });
      }
      
      setMeasurements(prev => prev.filter(m => m.id !== id));
    }
  };

  const deleteSinglePoint = (measurementId: string, pointIndex: number) => {
    const measurement = measurements.find(m => m.id === measurementId);
    
    if (!measurement || !measurementGroupRef.current) {
      return;
    }
    
    if (measurement.type === 'length' && measurement.points.length <= 2) {
      deleteMeasurement(measurementId);
      toast({
        title: "Messung gelöscht",
        description: "Die Messung wurde gelöscht, da sie mindestens zwei Punkte benötigt.",
      });
      return;
    }
    
    if (measurement.type === 'height' && measurement.points.length <= 2) {
      deleteMeasurement(measurementId);
      toast({
        title: "Messung gelöscht",
        description: "Die Messung wurde gelöscht, da sie mindestens zwei Punkte benötigt.",
      });
      return;
    }
    
    const pointToDelete = measurement.pointObjects?.[pointIndex];
    if (pointToDelete && measurementGroupRef.current) {
      pointToDelete.geometry.dispose();
      (pointToDelete.material as THREE.Material).dispose();
      measurementGroupRef.current.remove(pointToDelete);
    }
    
    setMeasurements(prevMeasurements => 
      prevMeasurements.map(m => {
        if (m.id === measurementId) {
          const updatedPoints = [...m.points];
          updatedPoints.splice(pointIndex, 1);
          
          const updatedPointObjects = [...(m.pointObjects || [])];
          updatedPointObjects.splice(pointIndex, 1);
          
          if (m.lineObjects && measurementGroupRef.current) {
            m.lineObjects.forEach(line => {
              line.geometry.dispose();
              (line.material as THREE.Material).dispose();
              measurementGroupRef.current?.remove(line);
            });
          }
          
          let newLineObjects: THREE.Line[] = [];
          if (updatedPoints.length >= 2) {
            if (m.type === 'length') {
              for (let i = 0; i < updatedPoints.length - 1; i++) {
                const line = createMeasurementLine(
                  [updatedPoints[i].position, updatedPoints[i + 1].position],
                  0x00ff00
                );
                measurementGroupRef.current?.add(line);
                newLineObjects.push(line);
              }
            } else if (m.type === 'height') {
              for (let i = 0; i < updatedPoints.length - 1; i++) {
                const verticalPoint = new THREE.Vector3(
                  updatedPoints[i].position.x,
                  updatedPoints[i + 1].position.y,
                  updatedPoints[i].position.z
                );
                
                const line = createMeasurementLine(
                  [updatedPoints[i].position, verticalPoint, updatedPoints[i + 1].position],
                  0x0000ff
                );
                measurementGroupRef.current?.add(line);
                newLineObjects.push(line);
              }
            }
          }
          
          let newValue = 0;
          let newInclination: number | undefined;
          let newLabelObject: THREE.Sprite | null = null;
          
          if (updatedPoints.length >= 2) {
            if (m.type === 'length') {
              for (let i = 0; i < updatedPoints.length - 1; i++) {
                newValue += calculateDistance(
                  updatedPoints[i].position,
                  updatedPoints[i + 1].position
                );
              }
              
              newInclination = calculateInclination(
                updatedPoints[0].position,
                updatedPoints[1].position
              );
              
              const midPoint = new THREE.Vector3().addVectors(
                updatedPoints[0].position,
                updatedPoints[updatedPoints.length - 1].position
              ).multiplyScalar(0.5);
              midPoint.y += 0.1;
              
              const labelText = formatMeasurementWithInclination(newValue, newInclination);
              newLabelObject = createTextSprite(labelText, midPoint, 0x00ff00);
              
              newLabelObject.userData = {
                isLabel: true,
                baseScale: { x: 0.8, y: 0.4, z: 1 }
              };
              
              if (cameraRef.current) {
                updateLabelScale(newLabelObject, cameraRef.current);
              }
              
              measurementGroupRef.current?.add(newLabelObject);
            } else if (m.type === 'height') {
              newValue = calculateHeight(
                updatedPoints[0].position,
                updatedPoints[updatedPoints.length - 1].position
              );
              
              const midHeight = (
                updatedPoints[0].position.y + 
                updatedPoints[updatedPoints.length - 1].position.y
              ) / 2;
              
              const midPoint = new THREE.Vector3(
                updatedPoints[0].position.x,
                midHeight,
                updatedPoints[0].position.z
              );
              midPoint.x += 0.1;
              
              const labelText = `${newValue.toFixed(2)} ${m.unit}`;
              newLabelObject = createTextSprite(labelText, midPoint, 0x0000ff);
              
              newLabelObject.userData = {
                isLabel: true,
                baseScale: { x: 0.8, y: 0.4, z: 1 }
              };
              
              if (cameraRef.current) {
                updateLabelScale(newLabelObject, cameraRef.current);
              }
              
              measurementGroupRef.current?.add(newLabelObject);
            }
          }
          
          return {
            ...m,
            points: updatedPoints,
            pointObjects: updatedPointObjects,
            lineObjects: newLineObjects,
            labelObject: newLabelObject,
            value: newValue,
            inclination: m.type === 'length' ? newInclination : undefined
          };
        }
        return m;
      })
    );
    
    toast({
      title: "Punkt gelöscht",
      description: "Der Messpunkt wurde erfolgreich gelöscht.",
    });
  };

  const deleteTempPoint = (index: number) => {
    if (temporaryPoints.length > index && measurementGroupRef.current) {
      const newPoints = [...temporaryPoints];
      const removedPoint = newPoints.splice(index, 1)[0];
      setTemporaryPoints(newPoints);
      
      const pointMesh = measurementGroupRef.current.children.find(
        child => child instanceof THREE.Mesh && 
        child.position.equals(removedPoint.position) &&
        child.name.startsWith('point-temp-')
      );
      
      if (pointMesh && pointMesh instanceof THREE.Mesh) {
        pointMesh.geometry.dispose();
        pointMesh.material.dispose();
        measurementGroupRef.current.remove(pointMesh);
      }
      
      if (currentMeasurementRef.current && currentMeasurementRef.current.lines.length > 0) {
        const lastLine = currentMeasurementRef.current.lines[currentMeasurementRef.current.lines.length - 1];
        if (lastLine && measurementGroupRef.current) {
          lastLine.geometry.dispose();
          (lastLine.material as THREE.Material).dispose();
          measurementGroupRef.current.remove(lastLine);
          currentMeasurementRef.current.lines.pop();
        }
      }
    }
  };

  const setProgress = (value: number) => {
    setState(prev => ({ ...prev, progress: value }));
  };

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
    
    controls.rotateSpeed = 0.5;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    
    const updateControlSpeed = () => {
      if (controlsRef.current && modelRef.current) {
        const box = new THREE.Box3().setFromObject(modelRef.current);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const distance = camera.position.distanceTo(center);
        
        controlsRef.current.rotateSpeed = 0.5 * (distance / maxDimension);
        controlsRef.current.panSpeed = 0.6 * (distance / maxDimension);
        controlsRef.current.zoomSpeed = 1.0 + (maxDimension / 10);
      }
    };
    
    controls.addEventListener('change', updateControlSpeed);
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
            child.quaternion.copy(cameraRef.current!.quaternion);
          
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
        rendererRef.current.setPixelRatio(window.devicePixelRatio);
        
        if (modelRef.current) {
          adjustCameraToModelSize();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    containerRef.current.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    containerRef.current.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', handleMouseDown);
        containerRef.current.removeEventListener('touchstart', handleTouchStart);
      }
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      
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

  const adjustCameraToModelSize = () => {
    if (!modelRef.current || !cameraRef.current || !controlsRef.current) return;
    
    const box = new THREE.Box3().setFromObject(modelRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const optimalDistance = maxDimension / (2 * Math.tan(fov / 2));
    
    const direction = new THREE.Vector3();
    direction.subVectors(cameraRef.current.position, center).normalize();
    
    const newPosition = new THREE.Vector3();
    newPosition.copy(center).add(direction.multiplyScalar(optimalDistance * 1.2));
    
    cameraRef.current.position.copy(newPosition);
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (isDraggingPoint) {
      setIsDraggingPoint(false);
      
      if (draggedPointRef.current?.userData) {
        draggedPointRef.current.userData.isBeingDragged = false;
      }
      
      draggedPointRef.current = null;
      document.body.style.cursor = hoveredPointId ? 'pointer' : 'auto';
      
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      
      if (selectedMeasurementId) {
        const measurement = measurements.find(m => m.id === selectedMeasurementId);
        if (measurement?.editMode) {
          toast({
            title: "Position aktualisiert",
            description: "Die Messung wurde an die neue Position angepasst.",
            duration: 3000,
          });
        } else {
          toast({
            title: "Position aktualisiert",
            description: "Die Messung wurde an die neue Position angepasst. Doppelklicken Sie auf den Punkt, um ihn zu deaktivieren.",
            duration: 3000,
          });
        }
      }
      
      setIsDraggingPoint(false);
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
    }
  };

  const handleMeasurementClick = (event: MouseEvent) => {
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
      
      if ((activeTool === 'length' || activeTool === 'height') && temporaryPoints.length === 1) {
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        finalizeMeasurement(newPoints);
      }
    }
  };
  
  const addMeasurementPoint = (position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    const pointName = `point-temp-${temporaryPoints.length}`;
    const point = createDraggablePoint(position, pointName);
    
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
      
      const line = createMeasurementLine(
        linePoints,
        activeTool === 'length' ? 0x00ff00 : 0x0000ff
      );
      
      measurementGroupRef.current.add(line);
      
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current.lines.push(line);
      }
      
      if (activeTool === 'length' || activeTool === 'height') {
        let value: number;
        let unit = 'm';
        let inclination: number | undefined = undefined;
        
        if (activeTool === 'length') {
          value = calculateDistance(prevPoint, position);
          inclination = calculateInclination(prevPoint, position);
          
          const midPoint = new THREE.Vector3().addVectors(prevPoint, position).multiplyScalar(0.5);
          midPoint.y += 0.1;
          
          const labelText = formatMeasurementWithInclination(value, inclination);
          const labelSprite = createTextSprite(labelText, midPoint, 0x00ff00);
          
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
  
  const finalizeMeasurement = useCallback((points: MeasurementPoint[], additionalData?: Partial<Measurement>) => {
    if (activeTool === 'none' || !points || points.length < 2) return;
    
    let value = 0;
    let unit = 'm';
    let inclination: number | undefined = undefined;
    
    if (additionalData?.value !== undefined) {
      value = additionalData.value;
    } else {
      if (activeTool === 'length' && points.length >= 2) {
        value = calculateDistance(points[0].position, points[1].position);
        inclination = calculateInclination(points[0].position, points[1].position);
      } else if (activeTool === 'height' && points.length >= 2) {
        value = calculateHeight(points[0].position, points[1].position);
      } else if (activeTool === 'area' && points.length >= 3) {
        const positions = points.map(p => p.position);
        value = calculatePolygonArea(positions);
        unit = 'm²';
      }
    }
    
    const newMeasurement: Measurement = {
      id: createMeasurementId(),
      type: activeTool,
      points: points,
      value: value,
      unit: unit,
      inclination: inclination,
      visible: true,
      isActive: false
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    setTemporaryPoints([]);
    
    console.log(`Measurement finalized: ${activeTool} with value ${value} ${unit}`);
    
    return newMeasurement;
  }, [activeTool]);

  const handleMeasurementTap = (touch: Touch) => {
    if (isDraggingPoint) return;
    
    if (activeTool === 'none' || !modelRef.current || !containerRef.current || 
        !sceneRef.current || !cameraRef.current) {
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
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
      
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
  };

  const clearMeasurements = () => {
    if (measurementGroupRef.current) {
      measurements.forEach(measurement => {
        if (measurement.labelObject) {
          if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
            if (measurement.labelObject.material.map) {
              measurement.labelObject.material.map.dispose();
            }
            measurement.labelObject.material.dispose();
          }
          measurementGroupRef.current?.remove(measurement.labelObject);
        }
        
        if (measurement.lineObjects) {
          measurement.lineObjects.forEach(line => {
            if (line) {
              if (line.geometry) line.geometry.dispose();
              if (line.material instanceof THREE.Material) line.material.dispose();
              else if (Array.isArray(line.material)) {
                line.material.forEach(mat => mat.dispose());
              }
              measurementGroupRef.current?.remove(line);
            }
          });
        }
        
        if (measurement.pointObjects) {
          measurement.pointObjects.forEach(point => {
            if (point) {
              if (point.geometry) point.geometry.dispose();
              if (point.material instanceof THREE.Material) point.material.dispose();
              else if (Array.isArray(point.material)) {
                point.material.forEach(mat => mat.dispose());
              }
              measurementGroupRef.current?.remove(point);
            }
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
    setMeasurements(prev => 
      prev.map(m => {
        if (m.id === id) {
          if (data.visible !== undefined && m.visible !== data.visible) {
            if (measurementGroupRef.current) {
              if (m.labelObject) {
                m.labelObject.visible = data.visible;
              }
              
              if (m.lineObjects) {
                m.lineObjects.forEach(line => {
                  if (line) line.visible = data.visible;
                });
              }
              
              if (m.pointObjects) {
                m.pointObjects.forEach(point => {
                  if (point) point.visible = data.visible;
                });
              }
            }
          }
          
          if (data.editMode !== undefined && m.editMode !== data.editMode) {
            if (measurementGroupRef.current && m.pointObjects) {
              m.pointObjects.forEach(point => {
                if (point) {
                  if (data.editMode) {
                    point.material = createEditablePointMaterial(false);
                  } else {
                    point.material = createDraggablePointMaterial(false);
                  }
                }
              });
            }
          }
          
          return { ...m, ...data };
        }
        return m;
      })
    );
  };

  useEffect(() => {
    if (!containerRef.current) return;
    
    if (activeTool !== 'none') {
      containerRef.current.addEventListener('click', handleMeasurementClick);
      
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
        controlsRef.current.rotateSpeed = 0.4;
      }
    } else {
      containerRef.current.removeEventListener('click', handleMeasurementClick);
      setTemporaryPoints([]);
      
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
        controlsRef.current.rotateSpeed = 0.7;
      }
    }
    
    return () => {
      containerRef.current?.removeEventListener('click', handleMeasurementClick);
    };
  }, [activeTool, temporaryPoints]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
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

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      setState({
        isLoading: true,
        progress: 0,
        error: null,
        loadedModel: null,
      });

      modelSizeRef.current = file.size;
      loadStartTimeRef.current = Date.now();

      const totalEstimatedTime = Math.max(3000, Math.min(15000, file.size / 100000));
      let lastUpdateTime = Date.now();

      progressIntervalRef.current = window.setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = currentTime - (loadStartTimeRef.current || 0);
        const deltaTime = currentTime - lastUpdateTime;
        lastUpdateTime = currentTime;
        
        const baseProgress = Math.min(99, (elapsedTime / totalEstimatedTime) * 100);
        
        let adjustedProgress = baseProgress;
        if (baseProgress > 90) {
          adjustedProgress = 90 + (baseProgress - 90) * 0.5;
        } else if (baseProgress > 80) {
          adjustedProgress = 80 + (baseProgress - 80) * 0.7;
        } else if (baseProgress > 70) {
          adjustedProgress = 70 + (baseProgress - 70) * 0.8;
        }
        
        setState(prev => ({
          ...prev,
          progress: Math.round(adjustedProgress)
        }));
      }, 100);

      const model = await loadGLBModel(file);

      processingStartTimeRef.current = Date.now();

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

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      setState({
        isLoading: false,
        progress: 100,
        error: null,
        loadedModel: model,
      });

      applyBackground(backgroundOptions.find(bg => bg.id === 'dark') || backgroundOptions[0]);
      
      setTimeout(() => {
        adjustCameraToModelSize();
      }, 300);
      
      if (onLoadComplete) {
        onLoadComplete();
      }

      return model;
    } catch (error) {
      console.error('Error loading model:', error);
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
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
      adjustCameraToModelSize();
      
      controlsRef.current.reset();
    }
  };

  const initScene = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      while (sceneRef.current.children.length > 0) {
        sceneRef.current.remove(sceneRef.current.children[0]);
      }
      
      cameraRef.current.position.set(0, 5, 10);
      cameraRef.current.lookAt(0, 0, 0);
      
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      sceneRef.current.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      sceneRef.current.add(directionalLight);
      
      const gridHelper = new THREE.GridHelper(20, 20);
      sceneRef.current.add(gridHelper);
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      
      setActiveTool('none');
      setState({
        isLoading: false,
        progress: 0,
        error: null,
        loadedModel: null
      });
      setMeasurements([]);
    }
  };

  const toggleMeasurementsVisibility = (visible: boolean) => {
    if (!measurementGroupRef.current) return;
    
    measurementGroupRef.current.traverse((child) => {
      if (child.name === 'hoverPoint') return;
      
      child.visible = visible;
    });
  };

  const updateModelViewer = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  return {
    isLoading: state.isLoading,
    progress: state.progress,
    error: state.error,
    loadedModel: state.loadedModel,
    measurements,
    activeTool,
    setActiveTool,
    clearMeasurements,
    undoLastPoint,
    finalizeMeasurement,
    deleteMeasurement,
    deleteSinglePoint,
    deleteTempPoint,
    updateMeasurement,
    toggleMeasurementsVisibility,
    setProgress,
    canUndo: temporaryPoints.length > 0,
    tempPoints: temporaryPoints,
    measurementGroupRef,
    loadModel,
    resetView,
    setBackground,
    camera: cameraRef.current,
    controls: controlsRef.current,
    scene: sceneRef.current,
    renderer: rendererRef.current,
  };
};

export default useModelViewer;
