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

  const setProgress = (value: number) => {
    setState(prev => ({ ...prev, progress: value }));
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
      
      setMeasurements([]);
    }
  };
  
  const resetView = () => {
    if (modelRef.current && cameraRef.current && controlsRef.current) {
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      let cameraDistance = maxDim / 2 / Math.tan(fov / 2);
      
      cameraDistance = Math.max(cameraDistance, 1);
      
      const direction = new THREE.Vector3(1, 0.5, 1).normalize();
      cameraRef.current.position.copy(center).add(direction.multiplyScalar(cameraDistance));
      cameraRef.current.lookAt(center);
      
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };
  
  const initScene = () => {
    if (!containerRef.current) return;
    
    if (sceneRef.current) {
      if (modelRef.current && sceneRef.current) {
        sceneRef.current.remove(modelRef.current);
        modelRef.current = null;
      }
      
      if (measurementGroupRef.current) {
        sceneRef.current.remove(measurementGroupRef.current);
      }
    }
    
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
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
  };
  
  const toggleMeasurementsVisibility = (visible: boolean) => {
    if (measurementGroupRef.current) {
      measurementGroupRef.current.visible = visible;
    }
  };
  
  const updateMeasurement = (id: string, updates: Partial<Measurement>) => {
    setMeasurements(prev => 
      prev.map(measurement => 
        measurement.id === id ? { ...measurement, ...updates } : measurement
      )
    );
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
        let inclination: number | undefined;
        
        if (activeTool === 'length') {
          value = calculateDistance(prevPoint, position);
          
          if (temporaryPoints.length === 1) {
            inclination = calculateInclination(prevPoint, position);
            
            const midPoint = new THREE.Vector3().addVectors(
              prevPoint, position
            ).multiplyScalar(0.5);
            midPoint.y += 0.1;
            
            const labelText = formatMeasurementWithInclination(value, inclination);
            const label = createTextSprite(labelText, midPoint, 0x00ff00);
            
            measurementGroupRef.current.add(label);
            
            if (currentMeasurementRef.current) {
              currentMeasurementRef.current.labels.push(label);
            }
          }
        } else {
          value = calculateHeight(prevPoint, position);
          
          const midHeight = (prevPoint.y + position.y) / 2;
          const labelPosition = new THREE.Vector3(
            prevPoint.x,
            midHeight,
            prevPoint.z
          );
          labelPosition.x += 0.1;
          
          const labelText = `${value.toFixed(2)} ${unit}`;
          const label = createTextSprite(labelText, labelPosition, 0x0000ff);
          
          measurementGroupRef.current.add(label);
          
          if (currentMeasurementRef.current) {
            currentMeasurementRef.current.labels.push(label);
          }
        }
      }
    }
  }
  
  const handleMeasurementTap = (event: TouchEvent) => {
    if (
      activeTool === 'none' || !modelRef.current || !containerRef.current || 
      !sceneRef.current || !cameraRef.current || event.touches.length > 0
    ) {
      return;
    }
    
    if (event.changedTouches.length > 0) {
      const touch = event.changedTouches[0];
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
      }
    }
  };

  const finalizeMeasurement = (points: MeasurementPoint[]) => {
    if (points.length < 2 || !measurementGroupRef.current) return;
    
    const id = createMeasurementId();
    
    let value: number;
    let unit = 'm';
    let inclination: number | undefined;
    
    if (activeTool === 'length') {
      value = calculateDistance(
        points[0].position,
        points[1].position
      );
      
      inclination = calculateInclination(
        points[0].position,
        points[1].position
      );
    } else {
      value = calculateHeight(
        points[0].position,
        points[1].position
      );
    }
    
    const labelPosition = activeTool === 'length'
      ? new THREE.Vector3().addVectors(
          points[0].position, 
          points[1].position
        ).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.1, 0))
      : new THREE.Vector3(
          points[0].position.x,
          (points[0].position.y + points[1].position.y) / 2,
          points[0].position.z
        ).add(new THREE.Vector3(0.1, 0, 0));
    
    const labelText = activeTool === 'length' 
      ? formatMeasurementWithInclination(value, inclination)
      : `${value.toFixed(2)} ${unit}`;
    
    const color = activeTool === 'length' ? 0x00ff00 : 0x0000ff;
    const labelSprite = createTextSprite(labelText, labelPosition, color);
    
    let linePoints: THREE.Vector3[];
    
    if (activeTool === 'height') {
      const verticalPoint = new THREE.Vector3(
        points[0].position.x,
        points[1].position.y,
        points[0].position.z
      );
      
      linePoints = [
        points[0].position,
        verticalPoint,
        points[1].position
      ];
    } else {
      linePoints = [
        points[0].position,
        points[1].position
      ];
    }
    
    const line = createMeasurementLine(linePoints, color);
    
    const pointMeshes = points.map((point, index) => {
      const pointMesh = createDraggablePoint(
        point.position,
        `point-${id}-${index}`
      );
      
      measurementGroupRef.current?.add(pointMesh);
      
      return pointMesh;
    });
    
    measurementGroupRef.current.add(line);
    measurementGroupRef.current.add(labelSprite);
    
    setMeasurements(prev => [
      ...prev,
      {
        id,
        type: activeTool,
        points,
        value,
        unit,
        inclination: activeTool === 'length' ? inclination : undefined,
        labelObject: labelSprite,
        lineObjects: [line],
        pointObjects: pointMeshes,
        editMode: false
      }
    ]);
    
    setTemporaryPoints([]);
    
    if (currentMeasurementRef.current) {
      currentMeasurementRef.current = null;
    }
    
    setActiveTool('none');
  };

  const toggleEditMode = (measurementId: string) => {
    setMeasurements(prevMeasurements =>
      prevMeasurements.map(measurement => {
        if (measurement.id === measurementId) {
          const editMode = !measurement.editMode;
          
          if (measurement.pointObjects) {
            measurement.pointObjects.forEach(point => {
              if (point instanceof THREE.Mesh) {
                point.material = editMode
                  ? createEditablePointMaterial(false)
                  : createDraggablePointMaterial(false);
              }
            });
          }
          
          toast({
            title: editMode ? "Bearbeitungsmodus aktiviert" : "Bearbeitungsmodus deaktiviert",
            description: editMode
              ? "Ziehen Sie die Punkte, um die Messung anzupassen."
              : "Die Messung wurde gespeichert.",
            duration: 3000,
          });
          
          return {
            ...measurement,
            editMode
          };
        }
        return measurement;
      })
    );
  };

  const loadModel = async (file: File) => {
    if (!sceneRef.current) {
      throw new Error("Scene not initialized");
    }
    
    setState({
      isLoading: true,
      progress: 0,
      error: null,
      loadedModel: null
    });
    
    if (modelRef.current && sceneRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }
    
    try {
      processingStartTimeRef.current = Date.now();
      
      const updateUploadProgress = (event: ProgressEvent<EventTarget>) => {
        const percent = Math.round((event.loaded / event.total) * 100);
        uploadProgressRef.current = percent;
        setProgress(percent * 0.5);
      };
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      
      processingIntervalRef.current = window.setInterval(() => {
        if (processingStartTimeRef.current) {
          const elapsed = Date.now() - processingStartTimeRef.current;
          const simulatedProcessingProgress = Math.min(
            49, 
            Math.floor(elapsed / 100)
          );
          
          const totalProgress = 50 + simulatedProcessingProgress;
          setProgress(totalProgress);
        }
      }, 100);
      
      const model = await loadGLBModel(file, updateUploadProgress);
      clearInterval(processingIntervalRef.current);
      
      setProgress(99);
      
      if (model) {
        centerModel(model);
        
        if (sceneRef.current) {
          sceneRef.current.add(model);
          
          if (cameraRef.current) {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = cameraRef.current.fov * (Math.PI / 180);
            let cameraDistance = maxDim / 2 / Math.tan(fov / 2);
            
            cameraDistance = Math.max(cameraDistance, 1);
            
            const direction = new THREE.Vector3(1, 0.5, 1).normalize();
            cameraRef.current.position.copy(center).add(direction.multiplyScalar(cameraDistance));
            cameraRef.current.lookAt(center);
            
            if (controlsRef.current) {
              controlsRef.current.target.copy(center);
              controlsRef.current.update();
            }
          }
        }
        
        modelRef.current = model;
        
        setState({
          isLoading: false,
          progress: 100,
          error: null,
          loadedModel: model
        });
        
        if (onLoadComplete) {
          onLoadComplete();
        }
        
        return model;
      } else {
        throw new Error("Failed to load model");
      }
    } catch (error) {
      console.error("Error loading model:", error);
      
      setState({
        isLoading: false,
        progress: 0,
        error: error instanceof Error ? error.message : "Unknown error",
        loadedModel: null
      });
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      
      throw error;
    }
  };

  const setBackgroundColor = async (option: BackgroundOption) => {
    setBackground(option);
    
    if (sceneRef.current && rendererRef.current) {
      if (option.id === 'color') {
        sceneRef.current.background = new THREE.Color(option.color);
        rendererRef.current.setClearColor(option.color, 1);
      } else if (option.id === 'image') {
        try {
          const texture = await loadTexture(option.src || '');
          sceneRef.current.background = texture;
        } catch (error) {
          console.error("Error loading background texture:", error);
        }
      }
    }
    
    return option;
  };

  useEffect(() => {
    initScene();
    
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
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [
    isDraggingPoint, 
    activeTool, 
    hoveredPointId, 
    modelRef.current,
    measurements
  ]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.addEventListener('click', handleMeasurementClick);
      
      return () => {
        containerRef.current?.removeEventListener('click', handleMeasurementClick);
      };
    }
  }, [
    activeTool, 
    temporaryPoints, 
    containerRef.current
  ]);

  useEffect(() => {
    if (background) {
      setBackgroundColor(background);
    }
  }, []);

  useEffect(() => {
    setCanUndo(temporaryPoints.length > 0);
  }, [temporaryPoints]);

  return {
    loadModel,
    background,
    setBackground: setBackgroundColor,
    activeTool,
    setActiveTool,
    measurements,
    setMeasurements,
    undoLastPoint,
    isLoading: state.isLoading,
    progress: state.progress,
    error: state.error,
    deleteMeasurement,
    toggleEditMode,
    hoverPoint,
    canUndo,
    loadedModel: modelRef.current,
    setProgress,
    resetView,
    clearMeasurements,
    initScene,
    renderer: rendererRef.current,
    scene: sceneRef.current,
    camera: cameraRef.current,
    measurementGroupRef,
    toggleMeasurementsVisibility,
    updateMeasurement,
    finalizeMeasurement
  };
};
