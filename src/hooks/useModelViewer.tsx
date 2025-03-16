
import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { calculatePolygonArea, clearPreviewObjects, updateMeasurementGeometry } from '@/utils/measurementUtils';

export type MeasurementPoint = {
  position: THREE.Vector3;
  worldPosition: THREE.Vector3;
};

export type Measurement = {
  id: string;
  type: 'distance' | 'angle' | 'area';
  points: MeasurementPoint[];
  value: number;
  unit: string;
  visible: boolean;
  editMode?: boolean;
  labelObject?: THREE.Sprite;
  lineObjects?: THREE.Line[];
  pointObjects?: THREE.Mesh[];
};

type ModelViewerHookProps = {
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadComplete?: () => void;
};

export function useModelViewer({ containerRef, onLoadComplete }: ModelViewerHookProps) {
  const [loadedModel, setLoadedModel] = useState<THREE.Group | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [tempPoints, setTemporaryPoints] = useState<MeasurementPoint[]>([]);
  const [activeTool, setActiveTool] = useState<'none' | 'distance' | 'angle' | 'area'>('none');
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const currentMeasurementRef = useRef<Measurement | null>(null);
  const canUndoRef = useRef<boolean>(false);

  const clearMeasurements = () => {
    if (measurementGroupRef.current) {
      console.log("Clearing all measurements");
      
      // First, remove all measurement objects
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
      
      // Clear all temporary points and lines
      const allTemporaryObjects = measurementGroupRef.current.children.filter(
        child => child.name.startsWith('point-temp-') || 
                child.name.startsWith('line-temp-') || 
                child.name === 'hoverPoint' ||
                child.name === 'preview-area'
      );
      
      allTemporaryObjects.forEach(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
          measurementGroupRef.current?.remove(obj);
        }
      });
      
      // Then remove any remaining objects that might be related to measurements
      const remainingMeasurementObjects = measurementGroupRef.current.children.filter(
        child => child.name.includes('point-') || 
                child.name.includes('line-') || 
                child.name.includes('area-') ||
                child.name.includes('label-')
      );
      
      remainingMeasurementObjects.forEach(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
          measurementGroupRef.current?.remove(obj);
        }
      });
    }
    
    setMeasurements([]);
    setTemporaryPoints([]);
    currentMeasurementRef.current = null;
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Create camera
    const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controlsRef.current = controls;

    // Create measurement group
    const measurementGroup = new THREE.Group();
    measurementGroup.name = 'measurements';
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      window.removeEventListener('resize', handleResize);
      
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      
      // Clean up resources
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          }
        });
      }
    };
  }, []);

  // Load model function
  const loadModel = useCallback(async (file: File) => {
    if (!sceneRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setProgress(0);
      
      // Remove previously loaded model if exists
      if (loadedModel) {
        sceneRef.current.remove(loadedModel);
        setLoadedModel(null);
      }
      
      const loader = new GLTFLoader();
      const fileUrl = URL.createObjectURL(file);
      
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          fileUrl,
          (gltf) => resolve(gltf),
          (progressEvent) => {
            const percentLoaded = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentLoaded);
          },
          (error) => reject(error)
        );
      });
      
      URL.revokeObjectURL(fileUrl);
      
      const model = gltf.scene;
      
      model.traverse((node: any) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      
      sceneRef.current.add(model);
      setLoadedModel(model);
      
      if (onLoadComplete) {
        onLoadComplete();
      }
      
      return model;
    } catch (error: any) {
      console.error("Error loading model:", error);
      setError(`Failed to load model: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadedModel, onLoadComplete]);

  // Reset view function
  const resetView = useCallback(() => {
    if (!controlsRef.current || !cameraRef.current) return;
    
    controlsRef.current.reset();
    cameraRef.current.position.set(0, 0, 5);
    controlsRef.current.update();
  }, []);

  // Handle adding a measurement point
  const addMeasurementPoint = useCallback((point: THREE.Vector3, isTemporary = false) => {
    const worldPoint = point.clone();
    const newPoint = { position: point.clone(), worldPosition: worldPoint };
    
    if (isTemporary) {
      setTemporaryPoints(prev => [...prev, newPoint]);
      canUndoRef.current = true;
    } else {
      if (currentMeasurementRef.current) {
        const updatedMeasurement = {
          ...currentMeasurementRef.current,
          points: [...currentMeasurementRef.current.points, newPoint]
        };
        
        currentMeasurementRef.current = updatedMeasurement;
        
        setMeasurements(prev => {
          const index = prev.findIndex(m => m.id === updatedMeasurement.id);
          if (index !== -1) {
            const updatedMeasurements = [...prev];
            updatedMeasurements[index] = updatedMeasurement;
            return updatedMeasurements;
          }
          return [...prev, updatedMeasurement];
        });
      }
    }
    
    return newPoint;
  }, []);

  // Undo last point
  const undoLastPoint = useCallback(() => {
    if (tempPoints.length > 0 && canUndoRef.current) {
      setTemporaryPoints(prev => prev.slice(0, -1));
      
      if (tempPoints.length <= 1) {
        canUndoRef.current = false;
      }
    }
  }, [tempPoints]);

  // Finalize a measurement
  const finalizeMeasurement = useCallback((points: MeasurementPoint[], additionalProps = {}) => {
    if (!activeTool || activeTool === 'none' || points.length === 0) return;
    
    const id = `${activeTool}-${Date.now()}`;
    let unit = '';
    let value = 0;
    
    switch (activeTool) {
      case 'distance':
        unit = 'm';
        if (points.length >= 2) {
          value = points[0].position.distanceTo(points[1].position);
        }
        break;
      case 'angle':
        unit = '°';
        if (points.length >= 3) {
          // Calculate angle logic
          const v1 = new THREE.Vector3().subVectors(points[0].position, points[1].position);
          const v2 = new THREE.Vector3().subVectors(points[2].position, points[1].position);
          value = v1.angleTo(v2) * (180 / Math.PI);
        }
        break;
      case 'area':
        unit = 'm²';
        if (points.length >= 3) {
          // Use the provided area calculation from props or calculate it
          if (additionalProps.hasOwnProperty('value')) {
            value = additionalProps.value as number;
          } else {
            const positions = points.map(p => p.position);
            value = calculatePolygonArea(positions);
          }
        }
        break;
    }
    
    const newMeasurement: Measurement = {
      id,
      type: activeTool,
      points: [...points],
      value,
      unit,
      visible: true,
      ...additionalProps
    };
    
    setMeasurements(prev => [...prev, newMeasurement]);
    setTemporaryPoints([]);
    currentMeasurementRef.current = newMeasurement;
    canUndoRef.current = false;
    
    return newMeasurement;
  }, [activeTool]);

  // Delete measurement
  const deleteMeasurement = useCallback((id: string) => {
    const measurementToDelete = measurements.find(m => m.id === id);
    
    if (measurementToDelete && measurementGroupRef.current) {
      // Clean up 3D objects associated with this measurement
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
      
      // Remove any other objects that might be related to this measurement
      const relatedObjects = measurementGroupRef.current.children.filter(
        child => child.name.includes(`-${id}`) || 
                child.name.includes(`${id}-`) ||
                child.name === `label-${id}`
      );
      
      relatedObjects.forEach(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
          measurementGroupRef.current?.remove(obj);
        }
      });
      
      // Remove the measurement from state
      setMeasurements(prev => prev.filter(m => m.id !== id));
    }
  }, [measurements]);

  // Update measurement
  const updateMeasurement = useCallback((id: string, updates: Partial<Measurement>) => {
    setMeasurements(prev => {
      const index = prev.findIndex(m => m.id === id);
      if (index !== -1) {
        const updatedMeasurement = { ...prev[index], ...updates };
        
        // If points were updated, we might need to recalculate the value
        if (updates.points && updatedMeasurement.type === 'area' && updatedMeasurement.points.length >= 3) {
          const positions = updatedMeasurement.points.map(p => p.position);
          updatedMeasurement.value = calculatePolygonArea(positions);
          
          // Update the geometry if we have the objects
          if (measurementGroupRef.current) {
            updateMeasurementGeometry(updatedMeasurement);
          }
        }
        
        const updatedMeasurements = [...prev];
        updatedMeasurements[index] = updatedMeasurement;
        return updatedMeasurements;
      }
      return prev;
    });
  }, []);

  // Delete a single point from a measurement
  const deleteSinglePoint = useCallback((measurementId: string, pointIndex: number) => {
    const measurement = measurements.find(m => m.id === measurementId);
    
    if (measurement && measurementGroupRef.current) {
      if (measurement.points.length <= 2) {
        // If we're deleting points from a measurement with only 2 points, delete the whole measurement
        deleteMeasurement(measurementId);
        return;
      }
      
      const updatedPoints = [...measurement.points];
      updatedPoints.splice(pointIndex, 1);
      
      // Remove the related point mesh
      const pointToRemove = measurementGroupRef.current.children.find(
        child => child.name === `point-${measurementId}-${pointIndex}`
      );
      
      if (pointToRemove && pointToRemove instanceof THREE.Mesh) {
        pointToRemove.geometry.dispose();
        (pointToRemove.material as THREE.Material).dispose();
        measurementGroupRef.current.remove(pointToRemove);
      }
      
      // Remove any lines connected to this point
      const linesToRemove = measurementGroupRef.current.children.filter(
        child => child.name === `line-${measurementId}-${pointIndex}` || 
                 child.name === `line-${measurementId}-${pointIndex-1}`
      );
      
      linesToRemove.forEach(line => {
        if (line instanceof THREE.Line) {
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(line);
        }
      });
      
      // Update the measurement
      updateMeasurement(measurementId, { points: updatedPoints });
      
      // If this was an area measurement, we need to recalculate the area
      if (measurement.type === 'area' && updatedPoints.length >= 3) {
        const positions = updatedPoints.map(p => p.position);
        const newArea = calculatePolygonArea(positions);
        updateMeasurement(measurementId, { value: newArea });
      }
    }
  }, [measurements, deleteMeasurement, updateMeasurement]);

  // Delete temporary point
  const deleteTempPoint = useCallback((index: number) => {
    if (index < 0 || index >= tempPoints.length) return;
    
    setTemporaryPoints(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    
    // If there are now 0 or 1 points, we can't undo anymore
    if (tempPoints.length <= 2) {
      canUndoRef.current = false;
    }
  }, [tempPoints]);

  // Toggle measurements visibility
  const toggleMeasurementsVisibility = useCallback((visible: boolean) => {
    if (measurementGroupRef.current) {
      measurementGroupRef.current.visible = visible;
    }
  }, []);

  return {
    loadedModel,
    isLoading,
    progress,
    error,
    measurements,
    tempPoints,
    activeTool,
    canUndo: canUndoRef.current,
    scene: sceneRef.current,
    camera: cameraRef.current,
    renderer: rendererRef.current,
    controls: controlsRef.current,
    measurementGroupRef,
    loadModel,
    resetView,
    setActiveTool,
    addMeasurementPoint,
    undoLastPoint,
    finalizeMeasurement,
    deleteMeasurement,
    updateMeasurement,
    deleteSinglePoint,
    deleteTempPoint,
    clearMeasurements,
    toggleMeasurementsVisibility,
    setProgress
  };
}
