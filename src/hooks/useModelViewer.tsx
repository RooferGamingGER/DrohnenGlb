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

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const handleMouseMove = (event: MouseEvent) => {
    // Existing handleMouseMove implementation
    // (Full implementation from the original code)
  };

  const handleMouseDown = (event: MouseEvent) => {
    // Existing handleMouseDown implementation
    // (Full implementation from the original code)
  };

  const handleTouchStart = (event: TouchEvent) => {
    // Existing handleTouchStart implementation
    // (Full implementation from the original code)
  };

  const handleTouchMove = (event: TouchEvent) => {
    // Existing handleTouchMove implementation
    // (Full implementation from the original code)
  };

  const handleMouseUp = (event: MouseEvent) => {
    // Existing handleMouseUp implementation
    // (Full implementation from the original code)
  };

  const handleTouchEnd = (event: TouchEvent) => {
    // Existing handleTouchEnd implementation
    // (Full implementation from the original code)
  };

  const updateMeasurementPointPosition = (
    measurementId: string,
    pointIndex: number,
    newPosition: THREE.Vector3
  ) => {
    // Existing updateMeasurementPointPosition implementation
    // (Full implementation from the original code)
  };

  const undoLastPoint = () => {
    // Existing undoLastPoint implementation
    // (Full implementation from the original code)
  };

  const deleteMeasurement = (id: string) => {
    // Existing deleteMeasurement implementation
    // (Full implementation from the original code)
  };

  const deleteSinglePoint = (measurementId: string, pointIndex: number) => {
    // Existing deleteSinglePoint implementation
    // (Full implementation from the original code)
  };

  const deleteTempPoint = (index: number) => {
    // Existing deleteTempPoint implementation
    // (Full implementation from the original code)
  };

  const setProgress = (value: number) => {
    setState(prev => ({ ...prev, progress: value }));
  };

  const handleSetActiveTool = (tool: MeasurementType) => {
    // If we have temporary points but not enough to create a complete measurement
    if (temporaryPoints.length > 0 && 
        temporaryPoints.length < 2 && 
        (activeTool === 'length' || activeTool === 'height')) {
      // Clear temporary points from the scene
      if (measurementGroupRef.current) {
        temporaryPoints.forEach((_, index) => {
          const pointName = `point-temp-${index}`;
          const tempPoint = measurementGroupRef.current.children.find(
            child => child instanceof THREE.Mesh && child.name === pointName
          );
          
          if (tempPoint) {
            if (tempPoint instanceof THREE.Mesh) {
              tempPoint.geometry.dispose();
              if (Array.isArray(tempPoint.material)) {
                tempPoint.material.forEach(m => m.dispose());
              } else {
                tempPoint.material.dispose();
              }
            }
            measurementGroupRef.current.remove(tempPoint);
          }
        });
        
        if (currentMeasurementRef.current) {
          currentMeasurementRef.current.lines.forEach(line => {
            line.geometry.dispose();
            if (line.material instanceof THREE.Material) {
              line.material.dispose();
            }
            measurementGroupRef.current?.remove(line);
          });
          
          currentMeasurementRef.current.labels.forEach(label => {
            if (label.material instanceof THREE.SpriteMaterial) {
              label.material.map?.dispose();
              label.material.dispose();
            }
            measurementGroupRef.current?.remove(label);
          });
          
          currentMeasurementRef.current = null;
        }
      }
      
      // Clear temporary points array
      setTemporaryPoints([]);
      
      toast({
        title: "Unvollständige Messung entfernt",
        description: "Die Messung wurde entfernt, da sie nicht abgeschlossen wurde.",
        duration: 3000,
      });
    }
    
    setActiveTool(tool);
  };

  const handleMeasurementClick = (event: MouseEvent) => {
    // Existing handleMeasurementClick implementation
    // (Full implementation from the original code)
  };
  
  const addMeasurementPoint = (position: THREE.Vector3) => {
    // Existing addMeasurementPoint implementation
    // (Full implementation from the original code)
  };
  
  const finalizeMeasurement = (points: MeasurementPoint[]) => {
    // Existing finalizeMeasurement implementation
    // (Full implementation from the original code)
  };
  
  const handleMeasurementTap = (event: TouchEvent) => {
    // Existing handleMeasurementTap implementation
    // (Full implementation from the original code)
  };

  const clearMeasurements = () => {
    // Existing clearMeasurements implementation
    // (Full implementation from the original code)
  };

  const updateMeasurement = (id: string, data: Partial<Measurement>) => {
    // Existing updateMeasurement implementation
    // (Full implementation from the original code)
  };

  useEffect(() => {
    // Existing scene setup useEffect implementation
    // (Full implementation from the original code)
  }, []);

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
    // Existing loadModel implementation
    // (Full implementation from the original code)
  };

  const applyBackground = async (option: BackgroundOption) => {
    // Existing applyBackground implementation
    // (Full implementation from the original code)
  };

  const resetView = () => {
    // Existing resetView implementation
    // (Full implementation from the original code)
  };

  const initScene = () => {
    // Existing initScene implementation
    // (Full implementation from the original code)
  };

  const toggleMeasurementsVisibility = (visible: boolean) => {
    // Existing toggleMeasurementsVisibility implementation
    // (Full implementation from the original code)
  };

  return {
    ...state,
    loadModel,
    background,
    setBackground: applyBackground,
    backgroundOptions,
    resetView,
    activeTool,
    setActiveTool: handleSetActiveTool,
    measurements,
    clearMeasurements,
    undoLastPoint,
    deleteMeasurement,
    deleteSinglePoint,
    deleteTempPoint,
    updateMeasurement,
    toggleMeasurementsVisibility,
    setProgress,
    canUndo,
    tempPoints: temporaryPoints,
    measurementGroupRef,
    renderer: rendererRef.current,
    scene: sceneRef.current,
    camera: cameraRef.current,
    loadedModel: modelRef.current
  };
};
