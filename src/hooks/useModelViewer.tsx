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
                if (measurement.labelObject.material.map) {
                  measurement.labelObject.material.map.dispose();
                }
                measurement.labelObject.material.dispose();
              }
              
              measurementGroupRef.current.remove(measurement.labelObject);
              measurementGroupRef.current.add(newSprite);
            }
            
            if (measurement.lineObjects && measurement.lineObjects.length > 0) {
              if (measurement.type === 'length') {
                const lineObject = measurement.lineObjects[0] as THREE.Line;
                if (lineObject.geometry) {
                  lineObject.geometry.dispose();
                }
                
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                  updatedPoints[0].position,
                  updatedPoints[1].position
                ]);
                
                (measurement.lineObjects[0] as THREE.Line).geometry = lineGeometry;
              } else {
                const lineObject = measurement.lineObjects[0] as THREE.Line;
                if (lineObject.geometry) {
                  lineObject.geometry.dispose();
                }
                
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
                
                (measurement.lineObjects[0] as THREE.Line).geometry = lineGeometry;
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
            if ((line as THREE.Line).geometry) (line as THREE.Line).geometry.dispose();
            if ((line as THREE.Line).material instanceof THREE.Material) (line as THREE.Line).material.dispose();
            else if (Array.isArray((line as THREE.Line).material)) {
              ((line as THREE.Line).material as THREE.Material[]).forEach(mat => mat.dispose());
            }
            measurementGroupRef.current?.remove(line);
          }
        });
      }
      
      if (measurementToDelete.pointObjects) {
        measurementToDelete.pointObjects.forEach(point => {
          if (point) {
            if ((point as THREE.Mesh).geometry) (point as THREE.Mesh).geometry.dispose();
            if ((point as THREE.Mesh).material instanceof THREE.Material) (point as THREE.Mesh).material.dispose();
            else if (Array.isArray((point as THREE.Mesh).material)) {
              ((point as THREE.Mesh).material as THREE.Material[]).forEach(mat => mat.dispose());
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
