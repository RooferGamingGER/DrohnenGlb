
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
  calculatePathDistance,
  calculateSegmentDistances,
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
  const [activeMultiPointMeasurement, setActiveMultiPointMeasurement] = useState(false);

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
  
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const currentMeasurementRef = useRef<{
    points: THREE.Vector3[];
    lines: THREE.Line[];
    labels: THREE.Sprite[];
    meshes: THREE.Mesh[];
  } | null>(null);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  
  const handleMouseMove = (event: MouseEvent) => {
    if (!containerRef.current || !modelRef.current || !cameraRef.current || activeTool === 'none') {
      if (hoverPoint) setHoverPoint(null);
      return;
    }
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
    
    if (intersects.length > 0) {
      setHoverPoint(intersects[0].point.clone());
    } else {
      setHoverPoint(null);
    }
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
      
      // If we just removed the second-to-last point in a length measurement, we're no longer in multi-point mode
      if (activeTool === 'length' && newPoints.length < 2) {
        setActiveMultiPointMeasurement(false);
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
      
      if (measurementToDelete.labelObjects) {
        measurementToDelete.labelObjects.forEach(label => {
          if (label.material instanceof THREE.SpriteMaterial) {
            label.material.map?.dispose();
            label.material.dispose();
          }
          measurementGroupRef.current?.remove(label);
        });
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

  const handleMeasurementClick = (event: MouseEvent) => {
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
      
      // For height measurements, we still only need 2 points
      if (activeTool === 'height' && temporaryPoints.length === 1) {
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        finalizeMeasurement(newPoints);
      }
      // For length measurements with multiple points
      else if (activeTool === 'length' && temporaryPoints.length >= 1) {
        setActiveMultiPointMeasurement(true);
      }
    }
  };
  
  const addMeasurementPoint = (position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    const pointGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.copy(position);
    
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
      
      // Add segment label for each line segment in length measurement
      if (activeTool === 'length') {
        let value = calculateDistance(prevPoint, position);
        let unit = 'm';
        
        const midPoint = new THREE.Vector3().addVectors(prevPoint, position).multiplyScalar(0.5);
        midPoint.y += 0.1;
        
        const labelText = `${value.toFixed(2)} ${unit}`;
        const labelSprite = createTextSprite(labelText, midPoint, 0x00ff00);
        
        labelSprite.userData = {
          ...labelSprite.userData,
          isLabel: true,
          baseScale: { x: 0.6, y: 0.3, z: 1 }
        };
        
        if (cameraRef.current) {
          updateLabelScale(labelSprite, cameraRef.current);
        }
        
        measurementGroupRef.current.add(labelSprite);
        
        if (currentMeasurementRef.current) {
          currentMeasurementRef.current.labels.push(labelSprite);
        }
      } 
      else if (activeTool === 'height') {
        let value = calculateHeight(prevPoint, position);
        let unit = 'm';
        
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
          baseScale: { x: 0.6, y: 0.3, z: 1 }
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
  };
  
  const finishMultiPointMeasurement = () => {
    if (activeTool === 'length' && temporaryPoints.length >= 2) {
      finalizeMeasurement(temporaryPoints);
      setActiveMultiPointMeasurement(false);
    }
  };
  
  const finalizeMeasurement = (points: MeasurementPoint[]) => {
    if (activeTool === 'none' || points.length < 2) return;
    
    let value = 0;
    let unit = 'm';
    let segmentValues: number[] = [];
    
    if (activeTool === 'length') {
      // Calculate total path length
      const allPositions = points.map(p => p.position);
      value = calculatePathDistance(allPositions);
      
      // Calculate individual segment distances
      segmentValues = calculateSegmentDistances(allPositions);
      
      // For multi-point paths, create a total distance label at the last point
      if (points.length > 2 && currentMeasurementRef.current) {
        const lastPoint = points[points.length - 1].position.clone();
        lastPoint.y += 0.2; // Position the total label above the last point
        
        const totalLabelText = `Total: ${value.toFixed(2)} ${unit}`;
        const totalLabelSprite = createTextSprite(totalLabelText, lastPoint, 0x00ff00);
        
        totalLabelSprite.userData = {
          ...totalLabelSprite.userData,
          isLabel: true,
          baseScale: { x: 0.8, y: 0.4, z: 1 }
        };
        
        if (cameraRef.current) {
          updateLabelScale(totalLabelSprite, cameraRef.current);
        }
        
        if (measurementGroupRef.current) {
          measurementGroupRef.current.add(totalLabelSprite);
        }
        
        currentMeasurementRef.current.labels.push(totalLabelSprite);
      }
    } else if (activeTool === 'height') {
      value = calculateHeight(points[0].position, points[1].position);
    }
    
    const measurementObjects = {
      pointObjects: currentMeasurementRef.current?.meshes || [],
      lineObjects: currentMeasurementRef.current?.lines || [],
      labelObjects: currentMeasurementRef.current?.labels || [],
      labelObject: currentMeasurementRef.current?.labels[currentMeasurementRef.current.labels.length - 1] || null
    };
    
    const newMeasurement: Measurement = {
      id: createMeasurementId(),
      type: activeTool,
      points: points,
      value,
      segmentValues: activeTool === 'length' ? segmentValues : undefined,
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
        
        if (measurement.labelObjects) {
          measurement.labelObjects.forEach(label => {
            if (label.material instanceof THREE.SpriteMaterial) {
              label.material.map?.dispose();
              label.material.dispose();
            }
            measurementGroupRef.current?.remove(label);
          });
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
    setActiveMultiPointMeasurement(false);
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
    
    if (activeTool !== 'none') {
      containerRef.current.addEventListener('click', handleMeasurementClick);
      
      if (controlsRef.current) {
        controlsRef.current.enableRotate = false;
      }
    } else {
      containerRef.current.removeEventListener('click', handleMeasurementClick);
      setTemporaryPoints([]);
      setActiveMultiPointMeasurement(false);
      
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
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
  }, [activeTool, temporaryPoints]);

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
    activeMultiPointMeasurement,
    finishMultiPointMeasurement
  };
};
