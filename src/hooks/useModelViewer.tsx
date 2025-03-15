
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
import { ScreenshotData } from '@/utils/screenshot/types';

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
  
  const [activeTool, setActiveToolState] = useState<MeasurementType>('none');
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
  const multiTouchStartDistanceRef = useRef<number | null>(null);
  const isMultiTouchRef = useRef<boolean>(false);

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
    if (!containerRef.current || !measurementGroupRef.current) return;
    
    if (event.touches.length > 1) {
      isMultiTouchRef.current = true;
      
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      multiTouchStartDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      
      return;
    }
    
    isMultiTouchRef.current = false;
    const touch = event.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    
    touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY };
    isTouchMoveRef.current = false;
    
    mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const pointObjects = measurementGroupRef.current.children.filter(
        child => child instanceof THREE.Mesh && child.name.startsWith('point-')
      );
      
      const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
      
      if (intersects.length > 0) {
        const currentTime = new Date().getTime();
        const pointMesh = intersects[0].object as THREE.Mesh;
        const pointId = pointMesh.name;
        setHoveredPointId(pointId);
        
        if (pointMesh.userData) {
          const lastTouchTime = lastTouchTimeRef.current || 0;
          
          if (isDoubleClick(currentTime, lastTouchTime)) {
            event.preventDefault();
            
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
              
              togglePointSelection(pointMesh);
              
              const nameParts = pointId.split('-');
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
                  description: "Bewegen Sie den Punkt an die gewünschte Position oder tippen Sie doppelt, um ihn zu deaktivieren.",
                  duration: 3000,
                });
              }
            }
          }
          
          lastTouchTimeRef.current = currentTime;
        }
      }
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!containerRef.current) return;
    
    if (event.touches.length > 1 && controlsRef.current) {
      event.preventDefault();
      
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      
      if (multiTouchStartDistanceRef.current) {
        const zoomSensitivity = 0.004;
        const zoomDelta = (multiTouchStartDistanceRef.current - newDistance) * zoomSensitivity;
        
        if (cameraRef.current && modelRef.current) {
          const box = new THREE.Box3().setFromObject(modelRef.current);
          const center = box.getCenter(new THREE.Vector3());
          
          const direction = new THREE.Vector3().subVectors(
            cameraRef.current.position, 
            controlsRef.current.target
          ).normalize();
          
          cameraRef.current.position.addScaledVector(direction, zoomDelta);
          
          const distance = cameraRef.current.position.distanceTo(controlsRef.current.target);
          if (distance < 0.5) {
            cameraRef.current.position.copy(
              controlsRef.current.target.clone().add(direction.multiplyScalar(0.5))
            );
          } else if (distance > 100) {
            cameraRef.current.position.copy(
              controlsRef.current.target.clone().add(direction.multiplyScalar(100))
            );
          }
          
          cameraRef.current.updateProjectionMatrix();
        }
        
        multiTouchStartDistanceRef.current = newDistance;
      }
      
      return;
    }
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      
      if (touchStartPositionRef.current) {
        const deltaX = Math.abs(touch.clientX - touchStartPositionRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPositionRef.current.y);
        
        if (deltaX > 8 || deltaY > 8) {
          isTouchMoveRef.current = true;
        }
      }
      
      if (isDraggingPoint && draggedPointRef.current && modelRef.current && cameraRef.current) {
        event.preventDefault();
        
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
      }
    }
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

  const handleTouchEnd = (event: TouchEvent) => {
    if (isMultiTouchRef.current) {
      isMultiTouchRef.current = false;
      multiTouchStartDistanceRef.current = null;
      return;
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
        description: "Die Messung wurde an die neue Position angepasst. Doppeltippen Sie auf den Punkt, um ihn zu deaktivieren.",
        duration: 3000,
      });
      
      setIsDraggingPoint(false);
    } else if (!isTouchMoveRef.current && activeTool !== 'none') {
      handleMeasurementTap(event);
    }
    
    touchStartPositionRef.current = null;
    isTouchMoveRef.current = false;
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
              for (let i = 0;i < updatedPoints.length - 1; i++) {
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
              
              const labelText = `${newValue.toFixed(2)} m`;
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
            value: newValue,
            inclination: newInclination,
            labelObject: newLabelObject
          };
        }
        return m;
      })
    );
  };

  const handleMeasurementTap = (event: TouchEvent) => {
    if (!containerRef.current || !modelRef.current || !cameraRef.current) return;
    
    if (activeTool === 'none') return;
    
    const touch = event.changedTouches[0];
    const rect = containerRef.current.getBoundingClientRect();
    
    mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
    
    if (intersects.length > 0) {
      const intersectedPoint = intersects[0].point.clone();
      handleMeasurementInteraction(intersectedPoint);
    }
  };

  const handleMeasurementInteraction = (point: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    if (activeTool === 'none') {
      return;
    }
    
    const tempPoint: MeasurementPoint = {
      id: `temp-point-${temporaryPoints.length}`,
      position: point.clone(),
      worldPosition: point.clone(),
    };
    
    const newTemporaryPoints = [...temporaryPoints, tempPoint];
    setTemporaryPoints(newTemporaryPoints);
    
    if (!currentMeasurementRef.current) {
      currentMeasurementRef.current = {
        points: [],
        lines: [],
        labels: [],
        meshes: []
      };
    }
    
    currentMeasurementRef.current.points.push(point.clone());
    
    const pointMesh = createDraggablePoint(point, `temp-point-${temporaryPoints.length}`);
    measurementGroupRef.current.add(pointMesh);
    currentMeasurementRef.current.meshes.push(pointMesh);
    
    setCanUndo(true);
    
    if (activeTool === 'length' || activeTool === 'height') {
      if (newTemporaryPoints.length >= 2) {
        const lastPoint = newTemporaryPoints[newTemporaryPoints.length - 2].position;
        const currentPoint = tempPoint.position;
        
        let value: number;
        let line: THREE.Line;
        
        if (activeTool === 'length') {
          line = createMeasurementLine([lastPoint, currentPoint], 0x00ff00);
          value = calculateDistance(lastPoint, currentPoint);
        } else {
          const verticalPoint = new THREE.Vector3(
            lastPoint.x,
            currentPoint.y,
            lastPoint.z
          );
          
          line = createMeasurementLine([lastPoint, verticalPoint, currentPoint], 0x0000ff);
          value = calculateHeight(lastPoint, currentPoint);
        }
        
        measurementGroupRef.current.add(line);
        currentMeasurementRef.current.lines.push(line);
        
        let labelPosition: THREE.Vector3;
        let labelText: string;
        let labelColor: number;
        
        if (activeTool === 'length') {
          labelPosition = new THREE.Vector3().addVectors(lastPoint, currentPoint).multiplyScalar(0.5);
          labelPosition.y += 0.1;
          
          const inclination = calculateInclination(lastPoint, currentPoint);
          labelText = formatMeasurementWithInclination(value, inclination);
          labelColor = 0x00ff00;
        } else {
          const midHeight = (lastPoint.y + currentPoint.y) / 2;
          labelPosition = new THREE.Vector3(lastPoint.x, midHeight, lastPoint.z);
          labelPosition.x += 0.1;
          
          labelText = `${value.toFixed(2)} m`;
          labelColor = 0x0000ff;
        }
        
        const label = createTextSprite(labelText, labelPosition, labelColor);
        label.name = `temp-label-${currentMeasurementRef.current.labels.length}`;
        
        label.userData = {
          isLabel: true,
          baseScale: { x: 0.8, y: 0.4, z: 1 }
        };
        
        if (cameraRef.current) {
          updateLabelScale(label, cameraRef.current);
        }
        
        measurementGroupRef.current.add(label);
        currentMeasurementRef.current.labels.push(label);
        
        if (newTemporaryPoints.length === 2) {
          completeMeasurement();
        }
      }
    }
  };

  const completeMeasurement = () => {
    if (!currentMeasurementRef.current || temporaryPoints.length === 0) return;
    
    const currentPoints = [...temporaryPoints];
    const type = activeTool;
    const id = createMeasurementId(type);
    
    let value: number = 0;
    let inclination: number | undefined;
    
    if (type === 'length') {
      if (currentPoints.length >= 2) {
        for (let i = 0; i < currentPoints.length - 1; i++) {
          value += calculateDistance(
            currentPoints[i].position,
            currentPoints[i + 1].position
          );
        }
        
        if (currentPoints.length === 2) {
          inclination = calculateInclination(
            currentPoints[0].position,
            currentPoints[1].position
          );
        }
      }
    } else if (type === 'height') {
      if (currentPoints.length >= 2) {
        value = calculateHeight(
          currentPoints[0].position,
          currentPoints[currentPoints.length - 1].position
        );
      }
    }
    
    const points = currentPoints.map((point, index) => ({
      ...point,
      id: `point-${id}-${index}`
    }));
    
    const pointObjects: THREE.Mesh[] = [];
    const lineObjects: THREE.Line[] = [];
    let labelObject: THREE.Sprite | null = null;
    
    if (measurementGroupRef.current) {
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current.meshes.forEach(mesh => {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(mesh);
        });
        
        currentMeasurementRef.current.lines.forEach(line => {
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(line);
        });
        
        currentMeasurementRef.current.labels.forEach(label => {
          if (label.material instanceof THREE.SpriteMaterial) {
            label.material.map?.dispose();
            label.material.dispose();
          }
          measurementGroupRef.current?.remove(label);
        });
      }
      
      points.forEach((point, index) => {
        const pointMesh = createDraggablePoint(point.position, `point-${id}-${index}`);
        measurementGroupRef.current?.add(pointMesh);
        pointObjects.push(pointMesh);
      });
      
      if (type === 'length') {
        for (let i = 0; i < points.length - 1; i++) {
          const line = createMeasurementLine(
            [points[i].position, points[i + 1].position],
            0x00ff00
          );
          measurementGroupRef.current.add(line);
          lineObjects.push(line);
        }
      } else if (type === 'height') {
        for (let i = 0; i < points.length - 1; i += 2) {
          const verticalPoint = new THREE.Vector3(
            points[i].position.x,
            points[i + 1].position.y,
            points[i].position.z
          );
          
          const line = createMeasurementLine(
            [points[i].position, verticalPoint, points[i + 1].position],
            0x0000ff
          );
          measurementGroupRef.current.add(line);
          lineObjects.push(line);
        }
      }
      
      let labelPosition: THREE.Vector3;
      let labelText: string;
      let labelColor: number;
      
      if (type === 'length') {
        labelPosition = new THREE.Vector3().addVectors(
          points[0].position,
          points[points.length - 1].position
        ).multiplyScalar(0.5);
        labelPosition.y += 0.1;
        
        labelText = formatMeasurementWithInclination(value, inclination);
        labelColor = 0x00ff00;
      } else {
        const midHeight = (points[0].position.y + points[points.length - 1].position.y) / 2;
        labelPosition = new THREE.Vector3(points[0].position.x, midHeight, points[0].position.z);
        labelPosition.x += 0.1;
        
        labelText = `${value.toFixed(2)} m`;
        labelColor = 0x0000ff;
      }
      
      labelObject = createTextSprite(labelText, labelPosition, labelColor);
      labelObject.name = `label-${id}`;
      
      labelObject.userData = {
        isLabel: true,
        baseScale: { x: 0.8, y: 0.4, z: 1 }
      };
      
      if (cameraRef.current) {
        updateLabelScale(labelObject, cameraRef.current);
      }
      
      measurementGroupRef.current.add(labelObject);
    }
    
    const newMeasurement: Measurement = {
      id,
      type,
      points,
      value,
      unit: 'm',
      inclination: type === 'length' ? inclination : undefined,
      pointObjects,
      lineObjects,
      labelObject,
      editMode: false
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    
    setTemporaryPoints([]);
    setCanUndo(false);
    
    currentMeasurementRef.current = {
      points: [],
      lines: [],
      labels: [],
      meshes: []
    };
    
    toast({
      title: "Messung abgeschlossen",
      description: `${type === 'length' ? 'Längenmessung' : 'Höhenmessung'} wurde erfolgreich abgeschlossen.`,
      duration: 3000,
    });
  };

  const cancelMeasurement = () => {
    if (!measurementGroupRef.current) return;
    
    if (currentMeasurementRef.current) {
      currentMeasurementRef.current.meshes.forEach(mesh => {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        measurementGroupRef.current?.remove(mesh);
      });
      
      currentMeasurementRef.current.lines.forEach(line => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        measurementGroupRef.current?.remove(line);
      });
      
      currentMeasurementRef.current.labels.forEach(label => {
        if (label.material instanceof THREE.SpriteMaterial) {
          label.material.map?.dispose();
          label.material.dispose();
        }
        measurementGroupRef.current?.remove(label);
      });
      
      currentMeasurementRef.current = {
        points: [],
        lines: [],
        labels: [],
        meshes: []
      };
    }
    
    setTemporaryPoints([]);
    setCanUndo(false);
    setActiveToolState('none');
    
    toast({
      title: "Messung abgebrochen",
      description: "Die Messung wurde abgebrochen.",
      duration: 3000,
    });
  };

  const setActiveTool = (tool: MeasurementType) => {
    if (temporaryPoints.length > 0) {
      if (window.confirm("Möchten Sie die aktuelle Messung abbrechen?")) {
        cancelMeasurement();
      } else {
        return;
      }
    }
    
    setActiveToolState(tool);
    
    if (tool === 'none') {
      if (hoveredPointId && measurementGroupRef.current) {
        const pointMesh = measurementGroupRef.current.children.find(
          child => child.name === hoveredPointId
        ) as THREE.Mesh;
        
        if (pointMesh && pointMesh.userData && pointMesh.userData.isBeingDragged) {
          pointMesh.userData.isBeingDragged = false;
          document.body.style.cursor = 'auto';
          setIsDraggingPoint(false);
          setSelectedMeasurementId(null);
          setSelectedPointIndex(null);
          
          if (controlsRef.current && controlsRef.current.enabled === false) {
            controlsRef.current.enabled = true;
          }
        }
      }
    }
  };

  const initScene = () => {
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x000000);
    
    lightsRef.current = {
      directional: new THREE.DirectionalLight(0xffffff, 0.5),
      ambient: new THREE.AmbientLight(0x404040)
    };
    
    sceneRef.current.add(lightsRef.current.directional);
    sceneRef.current.add(lightsRef.current.ambient);
    
    cameraRef.current = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current.position.z = 5;
    
    rendererRef.current = new THREE.WebGLRenderer();
    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current.setClearColor(0x000000);
    containerRef.current.appendChild(rendererRef.current.domElement);
    
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.zoomSpeed = 0.3;
    controlsRef.current.panSpeed = 0.3;
    controlsRef.current.rotateSpeed = 0.3;
  };

  const loadModel = (file: File) => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) {
      toast({
        title: "Fehler",
        description: "Keine Szene zum Laden verfügbar",
        variant: "destructive",
      });
      return;
    }
    
    loadGLBModel(file).then(model => {
      if (model) {
        centerModel(model);
        sceneRef.current.add(model);
        modelRef.current = model;
        
        if (onLoadComplete) onLoadComplete();
      }
    });
  };

  const resetCamera = () => {
    if (controlsRef.current && modelRef.current) {
      controlsRef.current.target.copy(modelRef.current.position);
      controlsRef.current.update();
    }
  };

  const capture = (options?: ScreenshotData) => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
      toast({
        title: "Fehler",
        description: "Keine Szene zum Aufnehmen verfügbar",
        variant: "destructive",
      });
      return null;
    }
    
    return rendererRef.current.domElement.toDataURL(options);
  };

  const clearScene = () => {
    if (sceneRef.current && modelRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
      
      if (measurementGroupRef.current) {
        measurements.forEach(measurement => {
          if (measurement.labelObject) {
            if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
              measurement.labelObject.material.map?.dispose();
              measurement.labelObject.material.dispose();
            }
          }
          
          if (measurement.lineObjects) {
            measurement.lineObjects.forEach(line => {
              line.geometry.dispose();
              (line.material as THREE.Material).dispose();
            });
          }
          
          if (measurement.pointObjects) {
            measurement.pointObjects.forEach(point => {
              point.geometry.dispose();
              (point.material as THREE.Material).dispose();
            });
          }
        });
        
        while (measurementGroupRef.current.children.length > 0) {
          const object = measurementGroupRef.current.children[0];
          measurementGroupRef.current.remove(object);
        }
      }
      
      setMeasurements([]);
      setTemporaryPoints([]);
      setActiveToolState('none');
      
      setState({
        isLoading: false,
        progress: 0,
        error: null,
        loadedModel: null,
      });
    }
  };

  const setBackground = (newBackground: BackgroundOption) => {
    setBackground(newBackground);
    
    if (sceneRef.current && sceneRef.current.background) {
      if (newBackground.type === 'color') {
        sceneRef.current.background = new THREE.Color(newBackground.value);
      } else if (newBackground.type === 'texture') {
        loadTexture(newBackground.value).then(texture => {
          if (sceneRef.current) {
            sceneRef.current.background = texture;
          }
        });
      }
    }
  };

  const setEditMode = (id: string, editMode: boolean) => {
    setMeasurements(prev => 
      prev.map(m => 
        m.id === id 
          ? { ...m, editMode } 
          : m
      )
    );
    
    if (measurementGroupRef.current) {
      const pointsToUpdate = measurementGroupRef.current.children.filter(
        child => child instanceof THREE.Mesh && child.name.startsWith(`point-${id}-`)
      );
      
      pointsToUpdate.forEach(point => {
        if (point instanceof THREE.Mesh) {
          point.material = editMode 
            ? createEditablePointMaterial(false) 
            : createDraggablePointMaterial(false);
        }
      });
    }
  };

  return {
    containerRef,
    
    state,
    
    loadModel: useCallback((file: File) => {
      if (!containerRef.current) {
        toast({
          title: "Fehler",
          description: "Container nicht gefunden",
          variant: "destructive",
        });
        return;
      }
      
      initScene();
      loadModel(file);
    }, [containerRef.current]),
    
    capture: useCallback((options?: ScreenshotData) => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        toast({
          title: "Fehler",
          description: "Keine Szene zum Aufnehmen verfügbar",
          variant: "destructive",
        });
        return null;
      }
      
      return capture(options);
    }, [sceneRef.current, cameraRef.current, rendererRef.current]),
    
    resetView: useCallback(() => {
      if (controlsRef.current && modelRef.current) {
        resetCamera();
      }
    }, [controlsRef.current, modelRef.current]),
    
    clearScene: useCallback(() => {
      if (sceneRef.current && modelRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
        
        if (measurementGroupRef.current) {
          measurements.forEach(measurement => {
            if (measurement.labelObject) {
              if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
                measurement.labelObject.material.map?.dispose();
                measurement.labelObject.material.dispose();
              }
            }
            
            if (measurement.lineObjects) {
              measurement.lineObjects.forEach(line => {
                line.geometry.dispose();
                (line.material as THREE.Material).dispose();
              });
            }
            
            if (measurement.pointObjects) {
              measurement.pointObjects.forEach(point => {
                point.geometry.dispose();
                (point.material as THREE.Material).dispose();
              });
            }
          });
          
          while (measurementGroupRef.current.children.length > 0) {
            const object = measurementGroupRef.current.children[0];
            measurementGroupRef.current.remove(object);
          }
        }
        
        setMeasurements([]);
        setTemporaryPoints([]);
        setActiveToolState('none');
        
        setState({
          isLoading: false,
          progress: 0,
          error: null,
          loadedModel: null,
        });
      }
    }, [sceneRef.current, modelRef.current]),
    
    background,
    setBackground: useCallback((newBackground: BackgroundOption) => {
      setBackground(newBackground);
      
      if (sceneRef.current && sceneRef.current.background) {
        if (newBackground.type === 'color') {
          sceneRef.current.background = new THREE.Color(newBackground.value);
        } else if (newBackground.type === 'texture') {
          loadTexture(newBackground.value).then(texture => {
            if (sceneRef.current) {
              sceneRef.current.background = texture;
            }
          });
        }
      }
    }, [sceneRef.current]),
    
    activeTool,
    setActiveTool,
    measurements,
    temporaryPoints,
    canUndo,
    undoLastPoint,
    deleteMeasurement,
    deleteSinglePoint,
    setEditMode: useCallback((id: string, editMode: boolean) => {
      setMeasurements(prev => 
        prev.map(m => 
          m.id === id 
            ? { ...m, editMode } 
            : m
        )
      );
      
      if (measurementGroupRef.current) {
        const pointsToUpdate = measurementGroupRef.current.children.filter(
          child => child instanceof THREE.Mesh && child.name.startsWith(`point-${id}-`)
        );
        
        pointsToUpdate.forEach(point => {
          if (point instanceof THREE.Mesh) {
            point.material = editMode 
              ? createEditablePointMaterial(false) 
              : createDraggablePointMaterial(false);
          }
        });
      }
    }, [measurementGroupRef.current]),
  };
};
