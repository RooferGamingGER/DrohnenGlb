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
  isInclinationSignificant,
  createAreaPolygon
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

  const touchStartPositionRef = useRef<{x: number, y: number} | null>(null);
  const isTouchMoveRef = useRef<boolean>(false);

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
    if (!containerRef.current || !measurementGroupRef.current || event.touches.length !== 1) return;
    
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
    if (!containerRef.current || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    
    if (touchStartPositionRef.current) {
      const deltaX = Math.abs(touch.clientX - touchStartPositionRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPositionRef.current.y);
      
      if (deltaX > 10 || deltaY > 10) {
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

  const createMeasurementFromPoints = (type: MeasurementType) => {
    if (type !== 'area' || temporaryPoints.length < 3) return;
    
    // Calculate area using Gauss formula
    let area = 0;
    const points = [...temporaryPoints];
    
    // For area calculation, we need at least 3 points
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].position.x * points[j].position.z;
      area -= points[j].position.x * points[i].position.z;
    }
    
    area = Math.abs(area) / 2;
    
    // Create the measurement ID and objects
    const measurementId = createMeasurementId();
    
    if (currentMeasurementRef.current && currentMeasurementRef.current.meshes) {
      currentMeasurementRef.current.meshes.forEach((mesh, index) => {
        mesh.name = `point-${measurementId}-${index}`;
      });
    }
    
    // Create area polygon visualization
    let areaPolygon = null;
    if (measurementGroupRef.current) {
      areaPolygon = createAreaPolygon(
        points.map(p => p.position), 
        measurementId
      );
      
      measurementGroupRef.current.add(areaPolygon);
    }
    
    // Create label for the area
    const center = new THREE.Vector3();
    points.forEach(p => center.add(p.position));
    center.divideScalar(points.length);
    center.y += 0.2; // Move label slightly above the polygon
    
    const labelText = `${area.toFixed(2)} m²`;
    const labelSprite = createTextSprite(labelText, center, 0x1E88E5);
    
    labelSprite.userData = {
      ...labelSprite.userData,
      isLabel: true,
      baseScale: { x: 0.8, y: 0.4, z: 1 }
    };
    
    if (cameraRef.current) {
      updateLabelScale(labelSprite, cameraRef.current);
    }
    
    if (measurementGroupRef.current) {
      measurementGroupRef.current.add(labelSprite);
    }
    
    const measurementObjects = {
      pointObjects: currentMeasurementRef.current?.meshes || [],
      lineObjects: currentMeasurementRef.current?.lines || [],
      labelObject: labelSprite,
      polygonObject: areaPolygon
    };
    
    const newMeasurement: Measurement = {
      id: measurementId,
      type: 'area',
      points: [...points],
      value: area,
      unit: 'm²',
      ...measurementObjects,
      visible: true
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    setTemporaryPoints([]);
    
    currentMeasurementRef.current = null;
    
    toast({
      title: "Flächenmessung erstellt",
      description: `Die Fläche beträgt ${area.toFixed(2)} m²`,
      duration: 3000,
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.Perspect
