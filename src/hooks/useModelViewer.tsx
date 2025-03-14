
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
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(0, 5, 10);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controlsRef.current = controls;

    // Set up lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    lightsRef.current = {
      ambient: ambientLight,
      directional: directionalLight
    };

    // Create a group for measurements
    const measurementGroup = new THREE.Group();
    measurementGroup.name = 'measurementGroup';
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const newAspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      cameraRef.current.aspect = newAspect;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(
        containerRef.current.clientWidth, 
        containerRef.current.clientHeight
      );
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) controlsRef.current.update();
      
      // Update label scales if camera or measurement objects exist
      if (cameraRef.current && measurementGroupRef.current) {
        measurementGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Sprite && child.userData && child.userData.isLabel) {
            updateLabelScale(child, cameraRef.current!);
          }
        });
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    // Apply initial background
    setBackgroundTexture(background);

    return () => {
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      
      window.removeEventListener('resize', handleResize);
      
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      
      // Clean up Three.js objects
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (sceneRef.current) {
        sceneRef.current.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else if (object.material) {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    setCanUndo(temporaryPoints.length > 0);
  }, [temporaryPoints]);

  const loadModel = async (file: File) => {
    if (!sceneRef.current) return null;
    
    try {
      setState({
        isLoading: true,
        progress: 0,
        error: null,
        loadedModel: null
      });
      
      processingStartTimeRef.current = Date.now();
      uploadProgressRef.current = 0;
      
      // Start a fake progress timer for processing time
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      
      processingIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - (processingStartTimeRef.current || 0);
        const estimatedTotal = 5000; // 5 seconds estimated total time
        
        let newProgress = Math.min((elapsed / estimatedTotal) * 100, 95);
        
        // If upload progress is significant, blend them
        if (uploadProgressRef.current > 0) {
          newProgress = (uploadProgressRef.current * 0.7) + (newProgress * 0.3);
        }
        
        setProgress(newProgress);
      }, 100);
      
      // Remove any existing model from the scene
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
      }
      
      // Clear measurements when loading a new model
      setMeasurements([]);
      setTemporaryPoints([]);
      
      if (measurementGroupRef.current) {
        // Remove all children from measurement group
        while (measurementGroupRef.current.children.length > 0) {
          const child = measurementGroupRef.current.children[0];
          
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Line) {
            child.geometry.dispose();
            
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Sprite) {
            if (child.material instanceof THREE.SpriteMaterial && child.material.map) {
              child.material.map.dispose();
            }
            child.material.dispose();
          }
          
          measurementGroupRef.current.remove(child);
        }
      }
      
      const model = await loadGLBModel(file, (progress) => {
        uploadProgressRef.current = progress * 100;
      });
      
      if (!model) throw new Error("Failed to load model");
      
      if (model && sceneRef.current) {
        centerModel(model);
        sceneRef.current.add(model);
        modelRef.current = model;
        setState(prev => ({ ...prev, loadedModel: model }));
        
        // Focus camera on the model
        if (controlsRef.current) {
          const boundingBox = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = cameraRef.current?.fov || 75;
          const cameraDistance = maxDim / (2 * Math.tan(fov * Math.PI / 360));
          
          cameraRef.current?.position.set(
            center.x, 
            center.y + maxDim * 0.5, 
            center.z + cameraDistance * 1.2
          );
          
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
      
      setState(prev => ({ ...prev, isLoading: false, progress: 100 }));
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
      
      if (onLoadComplete) {
        onLoadComplete();
      }
      
      return model;
    } catch (error) {
      console.error("Error loading model:", error);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : "Unknown error loading model" 
      }));
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
      
      return null;
    }
  };

  const setBackgroundTexture = async (option: BackgroundOption) => {
    if (!sceneRef.current) return;
    
    setBackground(option);
    
    if (option.type === 'color') {
      sceneRef.current.background = new THREE.Color(option.value);
      return;
    }
    
    if (option.type === 'texture' && option.value) {
      try {
        const texture = await loadTexture(option.value);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        sceneRef.current.background = texture;
      } catch (error) {
        console.error("Error loading background texture:", error);
        sceneRef.current.background = new THREE.Color(0x000000);
      }
    }
  };

  const clearMeasurements = () => {
    if (measurementGroupRef.current) {
      // Remove all objects from the measurement group
      while (measurementGroupRef.current.children.length > 0) {
        const child = measurementGroupRef.current.children[0];
        
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Line) {
          child.geometry.dispose();
          
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Sprite) {
          if (child.material instanceof THREE.SpriteMaterial && child.material.map) {
            child.material.map.dispose();
          }
          child.material.dispose();
        }
        
        measurementGroupRef.current.remove(child);
      }
    }
    
    setMeasurements([]);
    setTemporaryPoints([]);
    currentMeasurementRef.current = null;
  };

  const toggleMeasurementVisibility = (id: string, visible: boolean) => {
    setMeasurements(prev => 
      prev.map(measurement => {
        if (measurement.id === id) {
          if (measurement.pointObjects) {
            measurement.pointObjects.forEach(point => {
              point.visible = visible;
            });
          }
          
          if (measurement.lineObjects) {
            measurement.lineObjects.forEach(line => {
              line.visible = visible;
            });
          }
          
          if (measurement.labelObject) {
            measurement.labelObject.visible = visible;
          }
          
          if (measurement.polygonObject) {
            measurement.polygonObject.visible = visible;
          }
          
          return { ...measurement, visible };
        }
        return measurement;
      })
    );
  };

  const toggleMeasurementEditMode = (id: string, editMode: boolean) => {
    setMeasurements(prev => 
      prev.map(measurement => {
        if (measurement.id === id) {
          if (measurement.pointObjects) {
            measurement.pointObjects.forEach(point => {
              if (point instanceof THREE.Mesh) {
                point.material = editMode 
                  ? createEditablePointMaterial(false) 
                  : createDraggablePointMaterial(false);
              }
            });
          }
          
          return { ...measurement, editMode };
        }
        return measurement;
      })
    );
  };

  const handleClick = (event: MouseEvent) => {
    if (isDraggingPoint) return;
    
    if (activeTool !== 'none' && sceneRef.current && cameraRef.current && modelRef.current) {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        const hitPoint = intersects[0].point.clone();
        
        // Create measurement point
        const pointId = `temp-${temporaryPoints.length}`;
        const point: MeasurementPoint = {
          id: pointId,
          position: hitPoint.clone(),
          worldPosition: hitPoint.clone()
        };
        
        // Add to temporary points
        setTemporaryPoints(prev => [...prev, point]);
        
        // Create visual representation
        if (measurementGroupRef.current) {
          const pointMesh = createDraggablePoint(
            hitPoint, 
            `point-temp-${temporaryPoints.length}`,
            0xffcc00
          );
          
          measurementGroupRef.current.add(pointMesh);
          
          // Initialize the current measurement ref if needed
          if (!currentMeasurementRef.current) {
            currentMeasurementRef.current = {
              points: [],
              lines: [],
              labels: [],
              meshes: []
            };
          }
          
          currentMeasurementRef.current.points.push(hitPoint);
          currentMeasurementRef.current.meshes.push(pointMesh);
          
          // If we have at least two points, create a line between them
          if (temporaryPoints.length > 0) {
            const lastPoint = temporaryPoints[temporaryPoints.length - 1].position;
            
            let line;
            
            if (activeTool === 'height') {
              // For height measurement, we need an L-shaped line
              const verticalPoint = new THREE.Vector3(
                lastPoint.x,
                hitPoint.y,
                lastPoint.z
              );
              
              line = createMeasurementLine(
                [lastPoint, verticalPoint, hitPoint],
                `line-temp-${temporaryPoints.length - 1}`,
                0x0000ff
              );
            } else {
              // For length or area measurement, it's a straight line
              line = createMeasurementLine(
                [lastPoint, hitPoint],
                `line-temp-${temporaryPoints.length - 1}`,
                activeTool === 'length' ? 0x00ff00 : 0x1E88E5
              );
            }
            
            measurementGroupRef.current.add(line);
            currentMeasurementRef.current.lines.push(line);
            
            // For length and height measurements, we finish after 2 points
            if (activeTool === 'length' || activeTool === 'height') {
              if (temporaryPoints.length === 1) {
                let value: number;
                let inclination: number | undefined;
                
                if (activeTool === 'length') {
                  value = calculateDistance(lastPoint, hitPoint);
                  inclination = calculateInclination(lastPoint, hitPoint);
                } else {
                  value = calculateHeight(lastPoint, hitPoint);
                }
                
                const measurementId = createMeasurementId();
                
                // Create the measurement label
                let labelPosition: THREE.Vector3;
                
                if (activeTool === 'length') {
                  labelPosition = new THREE.Vector3().addVectors(lastPoint, hitPoint).multiplyScalar(0.5);
                  labelPosition.y += 0.1;
                } else {
                  // For height, place label at the midpoint of the height line
                  const midHeight = (lastPoint.y + hitPoint.y) / 2;
                  labelPosition = new THREE.Vector3(lastPoint.x, midHeight, lastPoint.z);
                  labelPosition.x += 0.1;
                }
                
                let labelText: string;
                
                if (activeTool === 'length') {
                  labelText = formatMeasurementWithInclination(value, inclination);
                } else {
                  labelText = `${value.toFixed(2)} m`;
                }
                
                const labelSprite = createTextSprite(
                  labelText,
                  labelPosition,
                  activeTool === 'length' ? 0x00ff00 : 0x0000ff
                );
                
                labelSprite.userData = {
                  ...labelSprite.userData,
                  isLabel: true,
                  baseScale: { x: 0.8, y: 0.4, z: 1 }
                };
                
                updateLabelScale(labelSprite, cameraRef.current);
                
                measurementGroupRef.current.add(labelSprite);
                
                // Update point names to include the measurement ID
                const pointObjects: THREE.Mesh[] = [];
                currentMeasurementRef.current.meshes.forEach((mesh, index) => {
                  mesh.name = `point-${measurementId}-${index}`;
                  pointObjects.push(mesh);
                });
                
                // Create the measurement object
                const newMeasurement: Measurement = {
                  id: measurementId,
                  type: activeTool,
                  points: [...temporaryPoints, point],
                  value: value,
                  inclination: activeTool === 'length' ? inclination : undefined,
                  unit: 'm',
                  pointObjects: pointObjects,
                  lineObjects: currentMeasurementRef.current.lines,
                  labelObject: labelSprite,
                  visible: true
                };
                
                setMeasurements(prev => [...prev, newMeasurement]);
                setTemporaryPoints([]);
                
                currentMeasurementRef.current = null;
                
                toast({
                  title: `${activeTool === 'length' ? 'Längen' : 'Höhen'}messung erstellt`,
                  description: `Die ${activeTool === 'length' ? 'Länge' : 'Höhe'} beträgt ${value.toFixed(2)} m`,
                  duration: 3000,
                });
              }
            }
          }
        }
      }
    }
  };

  const handleMeasurementTap = (event: TouchEvent) => {
    if (isDraggingPoint) return;
    
    if (activeTool !== 'none' && sceneRef.current && cameraRef.current && modelRef.current) {
      if (!containerRef.current || event.touches.length > 0) return;
      
      const touch = event.changedTouches[0];
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        const hitPoint = intersects[0].point.clone();
        
        // Create measurement point
        const pointId = `temp-${temporaryPoints.length}`;
        const point: MeasurementPoint = {
          id: pointId,
          position: hitPoint.clone(),
          worldPosition: hitPoint.clone()
        };
        
        // Add to temporary points
        setTemporaryPoints(prev => [...prev, point]);
        
        // Create visual representation
        if (measurementGroupRef.current) {
          const pointMesh = createDraggablePoint(
            hitPoint, 
            `point-temp-${temporaryPoints.length}`,
            0xffcc00
          );
          
          measurementGroupRef.current.add(pointMesh);
          
          // Initialize the current measurement ref if needed
          if (!currentMeasurementRef.current) {
            currentMeasurementRef.current = {
              points: [],
              lines: [],
              labels: [],
              meshes: []
            };
          }
          
          currentMeasurementRef.current.points.push(hitPoint);
          currentMeasurementRef.current.meshes.push(pointMesh);
          
          // If we have at least two points, create a line between them
          if (temporaryPoints.length > 0) {
            const lastPoint = temporaryPoints[temporaryPoints.length - 1].position;
            
            let line;
            
            if (activeTool === 'height') {
              // For height measurement, we need an L-shaped line
              const verticalPoint = new THREE.Vector3(
                lastPoint.x,
                hitPoint.y,
                lastPoint.z
              );
              
              line = createMeasurementLine(
                [lastPoint, verticalPoint, hitPoint],
                `line-temp-${temporaryPoints.length - 1}`,
                0x0000ff
              );
            } else {
              // For length or area measurement, it's a straight line
              line = createMeasurementLine(
                [lastPoint, hitPoint],
                `line-temp-${temporaryPoints.length - 1}`,
                activeTool === 'length' ? 0x00ff00 : 0x1E88E5
              );
            }
            
            measurementGroupRef.current.add(line);
            currentMeasurementRef.current.lines.push(line);
            
            // For length and height measurements, we finish after 2 points
            if (activeTool === 'length' || activeTool === 'height') {
              if (temporaryPoints.length === 1) {
                let value: number;
                let inclination: number | undefined;
                
                if (activeTool === 'length') {
                  value = calculateDistance(lastPoint, hitPoint);
                  inclination = calculateInclination(lastPoint, hitPoint);
                } else {
                  value = calculateHeight(lastPoint, hitPoint);
                }
                
                const measurementId = createMeasurementId();
                
                // Create the measurement label
                let labelPosition: THREE.Vector3;
                
                if (activeTool === 'length') {
                  labelPosition = new THREE.Vector3().addVectors(lastPoint, hitPoint).multiplyScalar(0.5);
                  labelPosition.y += 0.1;
                } else {
                  // For height, place label at the midpoint of the height line
                  const midHeight = (lastPoint.y + hitPoint.y) / 2;
                  labelPosition = new THREE.Vector3(lastPoint.x, midHeight, lastPoint.z);
                  labelPosition.x += 0.1;
                }
                
                let labelText: string;
                
                if (activeTool === 'length') {
                  labelText = formatMeasurementWithInclination(value, inclination);
                } else {
                  labelText = `${value.toFixed(2)} m`;
                }
                
                const labelSprite = createTextSprite(
                  labelText,
                  labelPosition,
                  activeTool === 'length' ? 0x00ff00 : 0x0000ff
                );
                
                labelSprite.userData = {
                  ...labelSprite.userData,
                  isLabel: true,
                  baseScale: { x: 0.8, y: 0.4, z: 1 }
                };
                
                updateLabelScale(labelSprite, cameraRef.current);
                
                measurementGroupRef.current.add(labelSprite);
                
                // Update point names to include the measurement ID
                const pointObjects: THREE.Mesh[] = [];
                currentMeasurementRef.current.meshes.forEach((mesh, index) => {
                  mesh.name = `point-${measurementId}-${index}`;
                  pointObjects.push(mesh);
                });
                
                // Create the measurement object
                const newMeasurement: Measurement = {
                  id: measurementId,
                  type: activeTool,
                  points: [...temporaryPoints, point],
                  value: value,
                  inclination: activeTool === 'length' ? inclination : undefined,
                  unit: 'm',
                  pointObjects: pointObjects,
                  lineObjects: currentMeasurementRef.current.lines,
                  labelObject: labelSprite,
                  visible: true
                };
                
                setMeasurements(prev => [...prev, newMeasurement]);
                setTemporaryPoints([]);
                
                currentMeasurementRef.current = null;
                
                toast({
                  title: `${activeTool === 'length' ? 'Längen' : 'Höhen'}messung erstellt`,
                  description: `Die ${activeTool === 'length' ? 'Länge' : 'Höhe'} beträgt ${value.toFixed(2)} m`,
                  duration: 3000,
                });
              }
            }
          }
        }
      }
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [activeTool, temporaryPoints, isDraggingPoint]);

  return {
    loadModel,
    background,
    setBackground: setBackgroundTexture,
    activeTool,
    setActiveTool,
    measurements,
    clearMeasurements,
    toggleMeasurementVisibility,
    toggleMeasurementEditMode,
    temporaryPoints,
    setTemporaryPoints,
    undoLastPoint,
    canUndo,
    hoverPoint,
    deleteMeasurement,
    deleteTempPoint,
    createMeasurementFromPoints,
    ...state
  };
};
