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
  calculateArea,
  createMeasurementId
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
  
  // Measurement visualization
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const currentMeasurementRef = useRef<{
    points: THREE.Vector3[];
    lines: THREE.Line[];
    labels: THREE.Sprite[];
  } | null>(null);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  
  // Handle mouse move for showing potential measurement points
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

  // Handle right click to cancel measurement
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (activeTool !== 'none' && temporaryPoints.length > 0) {
      setTemporaryPoints([]);
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current.lines.forEach(line => 
          measurementGroupRef.current?.remove(line)
        );
        currentMeasurementRef.current.labels.forEach(label => 
          measurementGroupRef.current?.remove(label)
        );
        currentMeasurementRef.current = null;
      }
      toast({
        title: "Messung abgebrochen",
        description: "Die aktuelle Messung wurde abgebrochen.",
        duration: 3000,
      });
    }
  };

  // Function to undo last point
  const undoLastPoint = () => {
    if (temporaryPoints.length > 0) {
      const newPoints = temporaryPoints.slice(0, -1);
      setTemporaryPoints(newPoints);
      
      if (measurementGroupRef.current) {
        // Remove last point visualization
        const lastPoint = measurementGroupRef.current.children.find(
          child => child instanceof THREE.Mesh && 
          child.position.equals(temporaryPoints[temporaryPoints.length - 1].position)
        );
        if (lastPoint) measurementGroupRef.current.remove(lastPoint);
        
        // Remove last line if it exists
        if (currentMeasurementRef.current?.lines.length) {
          const lastLine = currentMeasurementRef.current.lines[currentMeasurementRef.current.lines.length - 1];
          measurementGroupRef.current.remove(lastLine);
          currentMeasurementRef.current.lines.pop();
        }
        
        // Remove last label if it exists
        if (currentMeasurementRef.current?.labels.length) {
          const lastLabel = currentMeasurementRef.current.labels[currentMeasurementRef.current.labels.length - 1];
          measurementGroupRef.current.remove(lastLabel);
          currentMeasurementRef.current.labels.pop();
        }
      }
      
      // Update area preview if applicable
      if (activeTool === 'area' && newPoints.length >= 2) {
        updateAreaPreview(newPoints);
      }
    }
  };

  // Function to delete individual measurement
  const deleteMeasurement = (id: string) => {
    const measurementToDelete = measurements.find(m => m.id === id);
    if (measurementToDelete && measurementGroupRef.current) {
      // Remove visualization for this measurement
      const pointsToRemove = measurementToDelete.points.map(p => p.position);
      measurementGroupRef.current.children.forEach(child => {
        if (child instanceof THREE.Mesh && pointsToRemove.some(p => p.equals(child.position))) {
          measurementGroupRef.current?.remove(child);
        }
      });
      
      setMeasurements(prev => prev.filter(m => m.id !== id));
      toast({
        title: "Messung gelöscht",
        description: "Die ausgewählte Messung wurde entfernt.",
        duration: 3000,
      });
    }
  };

  // Show hover point
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
      
      // Remove any existing hover point
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
    
    // Create measurement group
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

  // Handle click events for measurements
  const handleMeasurementClick = (event: MouseEvent) => {
    if (activeTool === 'none' || !modelRef.current || !containerRef.current || 
        !sceneRef.current || !cameraRef.current) {
      return;
    }
    
    // Calculate mouse position in normalized device coordinates
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Cast ray from camera through mouse position
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // Check for intersections with the model
    const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
    
    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      const worldPoint = point.clone();
      
      // Add point to temporary points
      setTemporaryPoints(prev => [...prev, { 
        position: point,
        worldPosition: worldPoint
      }]);
      
      // Visualize the point
      addMeasurementPoint(point);
      
      // Process measurement when enough points are collected
      if ((activeTool === 'length' || activeTool === 'height') && temporaryPoints.length === 1) {
        // We now have 2 points including the new one, create the measurement
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        finalizeMeasurement(newPoints);
      } else if (activeTool === 'area' && temporaryPoints.length >= 2) {
        // For area, we need at least 3 points
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        updateAreaPreview(newPoints);
        
        // Double-click to finalize area measurement
        if (event.detail === 2 && newPoints.length >= 3) {
          finalizeMeasurement(newPoints);
        }
      }
    }
  };
  
  // Add visualization for a measurement point
  const addMeasurementPoint = (position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    // Create point geometry
    const pointGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.copy(position);
    
    measurementGroupRef.current.add(point);
    
    // Add line between points if this is not the first point
    if (temporaryPoints.length > 0) {
      const prevPoint = temporaryPoints[temporaryPoints.length - 1].position;
      
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: activeTool === 'length' ? 0x00ff00 : 
               activeTool === 'height' ? 0x0000ff : 0xff00ff,
        linewidth: 2
      });
      
      // Create line geometry
      let linePoints: THREE.Vector3[];
      
      if (activeTool === 'height') {
        // For height measurement, create a vertical line
        const verticalPoint = new THREE.Vector3(
          prevPoint.x, 
          position.y,
          prevPoint.z
        );
        
        linePoints = [prevPoint, verticalPoint, position];
      } else {
        // For length or area, create a direct line
        linePoints = [prevPoint, position];
      }
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      measurementGroupRef.current.add(line);
      
      // Add measurement label for length and height
      if (activeTool === 'length' || activeTool === 'height') {
        const midPoint = new THREE.Vector3().addVectors(prevPoint, position).multiplyScalar(0.5);
        
        let value: number;
        let unit = 'm';
        
        if (activeTool === 'length') {
          value = calculateDistance(prevPoint, position);
        } else { // height
          value = calculateHeight(prevPoint, position);
        }
        
        addMeasurementLabel(midPoint, value, unit);
      }
    }
  };
  
  // Add text label for measurement
  const addMeasurementLabel = (position: THREE.Vector3, value: number, unit: string) => {
    if (!measurementGroupRef.current) return;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 36px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${value.toFixed(2)} ${unit}`, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.copy(position);
    sprite.scale.set(1, 0.5, 1);
    
    measurementGroupRef.current.add(sprite);
  };
  
  // Update area preview while adding points
  const updateAreaPreview = (points: MeasurementPoint[]) => {
    if (!measurementGroupRef.current || points.length < 3) return;
    
    // Remove previous area preview if it exists
    if (currentMeasurementRef.current) {
      currentMeasurementRef.current.lines.forEach(line => 
        measurementGroupRef.current?.remove(line)
      );
      currentMeasurementRef.current.labels.forEach(label => 
        measurementGroupRef.current?.remove(label)
      );
    }
    
    // Create closed polygon
    const linePoints = [...points.map(p => p.position)];
    linePoints.push(linePoints[0]); // Close the loop
    
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff00ff,
      linewidth: 2
    });
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    measurementGroupRef.current.add(line);
    
    // Calculate area
    const area = calculateArea(points.map(p => p.position));
    
    // Add area label at the center of the polygon
    const center = new THREE.Vector3();
    for (const point of points) {
      center.add(point.position);
    }
    center.divideScalar(points.length);
    
    // Create label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = 'bold 36px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${area.toFixed(2)} m²`, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.copy(center);
    sprite.scale.set(1, 0.5, 1);
    
    measurementGroupRef.current.add(sprite);
    
    // Store current area preview
    currentMeasurementRef.current = {
      points: points.map(p => p.position),
      lines: [line],
      labels: [sprite]
    };
  };
  
  // Finalize a measurement and add it to the measurements array
  const finalizeMeasurement = (points: MeasurementPoint[]) => {
    if (activeTool === 'none' || points.length < 2) return;
    
    let value = 0;
    let unit = 'm';
    
    if (activeTool === 'length') {
      value = calculateDistance(points[0].position, points[1].position);
    } else if (activeTool === 'height') {
      value = calculateHeight(points[0].position, points[1].position);
    } else if (activeTool === 'area' && points.length >= 3) {
      value = calculateArea(points.map(p => p.position));
      unit = 'm²';
    }
    
    const newMeasurement: Measurement = {
      id: createMeasurementId(),
      type: activeTool,
      points: points,
      value,
      unit
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    setTemporaryPoints([]);
    
    // Reset current area preview
    currentMeasurementRef.current = null;
    
    // Show toast with measurement result
    toast({
      title: `Messung abgeschlossen`,
      description: activeTool === 'area' 
        ? `Fläche: ${value.toFixed(2)} ${unit}`
        : activeTool === 'height'
        ? `Höhe: ${value.toFixed(2)} ${unit}`
        : `Länge: ${value.toFixed(2)} ${unit}`,
      duration: 3000,
    });
  };
  
  // Clear all measurements
  const clearMeasurements = () => {
    setMeasurements([]);
    setTemporaryPoints([]);
    
    // Clear visualization
    if (measurementGroupRef.current) {
      while (measurementGroupRef.current.children.length > 0) {
        const object = measurementGroupRef.current.children[0];
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        } else if (object instanceof THREE.Line) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        } else if (object instanceof THREE.Sprite) {
          (object.material as THREE.SpriteMaterial).map?.dispose();
          (object.material as THREE.Material).dispose();
        }
        measurementGroupRef.current.remove(object);
      }
    }
    
    currentMeasurementRef.current = null;
    
    toast({
      title: "Messungen gelöscht",
      description: "Alle Messungen wurden entfernt.",
      duration: 3000,
    });
  };

  // Set up click handler when activeTool changes
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
      
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
      }
    }
    
    return () => {
      containerRef.current?.removeEventListener('click', handleMeasurementClick);
    };
  }, [activeTool, temporaryPoints]);

  // Set up event listeners
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [activeTool, temporaryPoints]);

  // Update canUndo state
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

      // Clear existing measurements when loading a new model
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

      toast({
        title: "Modell geladen",
        description: "Das 3D-Modell wurde erfolgreich geladen. Sie können es jetzt von allen Seiten betrachten.",
        duration: 3000,
      });

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
    canUndo,
  };
};
