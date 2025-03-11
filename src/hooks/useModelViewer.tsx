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
  createDraggablePointMaterial,
  createDraggablePointMesh
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
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      
      if (isDraggingPoint) {
        event.preventDefault();
      }
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
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
    }
    else if ((activeTool === 'length' || activeTool === 'height') && modelRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        setHoverPoint(intersects[0].point.clone());
      } else {
        setHoverPoint(null);
      }
    }
    else if ((activeTool === 'none' || activeTool === 'move') && measurementGroupRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const pointObjects = measurementGroupRef.current.children.filter(
        child => child instanceof THREE.Mesh && child.name.startsWith('point-')
      );
      
      const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
      
      if (intersects.length > 0) {
        const pointId = intersects[0].object.name;
        setHoveredPointId(pointId);
        
        if (activeTool === 'move') {
          document.body.style.cursor = 'grab';
        } else {
          document.body.style.cursor = 'pointer';
        }
        
        if (intersects[0].object instanceof THREE.Mesh) {
          intersects[0].object.material = createDraggablePointMaterial(true);
        }
      } else {
        if (hoveredPointId) {
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
    
    previousMouseRef.current.copy(mouseRef.current);
  };

  const handleMouseDown = (event: MouseEvent | TouchEvent) => {
    if (!containerRef.current || !measurementGroupRef.current) return;
    
    if ('touches' in event && event.touches.length > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
      
      if (activeTool === 'move' || hoveredPointId) {
        event.preventDefault();
      }
    }
    
    if (hoveredPointId && (activeTool === 'move' || activeTool === 'none')) {
      if ('stopPropagation' in event) event.stopPropagation();
      if ('preventDefault' in event) event.preventDefault();
      
      const pointMesh = measurementGroupRef.current.children.find(
        child => child.name === hoveredPointId
      ) as THREE.Mesh;
      
      if (pointMesh) {
        setIsDraggingPoint(true);
        draggedPointRef.current = pointMesh;
        document.body.style.cursor = 'grabbing';
        
        const nameParts = hoveredPointId.split('-');
        if (nameParts.length >= 3) {
          const measurementId = nameParts[1];
          const pointIndex = parseInt(nameParts[2], 10);
          
          setSelectedMeasurementId(measurementId);
          setSelectedPointIndex(pointIndex);
          
          setMeasurements(prev => prev.map(m => ({
            ...m,
            isActive: m.id === measurementId
          })));
          
          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
          
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
      setIsDraggingPoint(false);
      draggedPointRef.current = null;
      document.body.style.cursor = hoveredPointId ? 'grab' : 'auto';
      
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      
      setMeasurements(prev => prev.map(m => ({
        ...m,
        isActive: false
      })));
      
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
      
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
          const updatedPoints = [...measurement.points];
          
          if (updatedPoints[pointIndex]) {
            updatedPoints[pointIndex] = {
              ...updatedPoints[pointIndex],
              position: newPosition,
              worldPosition: newPosition.clone()
            };
          }
          
          let newValue: number;
          if (measurement.type === 'length') {
            newValue = calculateDistance(
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
            
            const labelText = `${newValue.toFixed(2)} ${measurement.unit}`;
            
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
      }
    };

    window.addEventListener('resize', handleResize);
    
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
    if (isDraggingPoint || hoveredPointId || activeTool === 'move') return;
    
    if (activeTool === 'none' || !modelRef.current || !containerRef.current || 
        !sceneRef.current || !cameraRef.current) {
      return;
    }
    
    let clientX: number, clientY: number;
    
    if ('touches' in event) {
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
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
    
    const point = createDraggablePointMesh(position);
    
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
      
      setMeasurements([]);
      setTemporaryPoints([]);
      
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current = null;
      }
    }
  };

  const loadModel = async (file: File): Promise<void> => {
    if (modelRef.current && sceneRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }
    
    setState({
      isLoading: true,
      progress: 0,
      error: null,
      loadedModel: null,
    });
    
    try {
      processingStartTimeRef.current = Date.now();
      
      // Simulate upload progress
      processingIntervalRef.current = window.setInterval(() => {
        if (uploadProgressRef.current < 90) {
          uploadProgressRef.current += 5;
          setState(prev => ({ ...prev, progress: uploadProgressRef.current }));
        }
      }, 300);
      
      const model = await loadGLBModel(file, (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setState(prev => ({ ...prev, progress }));
        }
      });
      
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
      
      if (!sceneRef.current) return;
      
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // If material is an array, process each material
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.map) mat.map.anisotropy = 16;
              });
            } else {
              // Single material
              if (child.material.map) child.material.map.anisotropy = 16;
            }
          }
        }
      });
      
      const box = centerModel(model);
      
      // Calculate size for camera positioning
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current?.fov || 45;
      const cameraZ = maxDim / (2 * Math.tan((fov * Math.PI) / 360));
      
      // Position camera to fit model
      if (cameraRef.current) {
        cameraRef.current.position.z = cameraZ * 1.5;
        cameraRef.current.updateProjectionMatrix();
      }
      
      // Reset controls
      if (controlsRef.current) {
        controlsRef.current.reset();
        controlsRef.current.target.set(0, 0, 0);
      }
      
      clearMeasurements();
      
      if (sceneRef.current) {
        sceneRef.current.add(model);
        modelRef.current = model;
      }
      
      setState({
        isLoading: false,
        progress: 100,
        error: null,
        loadedModel: model,
      });
      
    } catch (error) {
      console.error("Error loading model:", error);
      
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
