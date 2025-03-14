import { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { useFrame } from '@react-three/fiber';
import { calculateDistance, Measurement, MeasurementType, createMeasurementId, createTextSprite, createDraggablePoint, createMeasurementLine, updateMeasurementLine, updateLabelScale, MeasurementPoint } from '@/utils/measurementUtils';

interface ModelViewerHookProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onLoadComplete?: () => void;
}

const useModelViewer = ({ containerRef, onLoadComplete }: ModelViewerHookProps) => {
  const [loadedModel, setLoadedModel] = useState<THREE.Group | null>(null);
  const [scene, setScene] = useState<THREE.Scene | null>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [activeTool, setActiveTool] = useState<MeasurementType>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tempPoints, setTempPoints] = useState<MeasurementPoint[] | null>(null);

  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const tempPointsRef = useRef<THREE.Mesh[]>([]);
  const undoHistoryRef = useRef<Measurement[][]>([]);
  const containerWidthRef = useRef<number>(0);
  const containerHeightRef = useRef<number>(0);

  // Funktion zum Löschen eines temporären Punkts
  const deleteTempPoint = useCallback((index: number) => {
    console.log(`Löschen des temporären Punkts mit Index ${index}`);
    
    setTempPoints(prev => {
      if (!prev || index < 0 || index >= prev.length) {
        console.error("Ungültiger Index oder keine temporären Punkte zum Löschen", index, prev?.length);
        return prev;
      }
      
      // Visuellen Punkt aus der Szene entfernen
      if (tempPointsRef.current && tempPointsRef.current[index]) {
        console.log("Entferne visuellen Punkt aus der Szene");
        const pointToRemove = tempPointsRef.current[index];
        
        if (pointToRemove && measurementGroupRef.current) {
          // Entferne den Punkt aus der Szene
          measurementGroupRef.current.remove(pointToRemove);
          
          // Ressourcen freigeben
          if (pointToRemove instanceof THREE.Mesh) {
            if (pointToRemove.geometry) {
              pointToRemove.geometry.dispose();
            }
            if (pointToRemove.material && pointToRemove.material instanceof THREE.Material) {
              pointToRemove.material.dispose();
            }
          }
        }
        
        // Update der Referenz-Array
        tempPointsRef.current = tempPointsRef.current.filter((_, i) => i !== index);
      }
      
      // Logisch den Punkt aus dem State entfernen
      const newPoints = [...prev];
      newPoints.splice(index, 1);
      console.log("Neue Anzahl temporärer Punkte:", newPoints.length);
      return newPoints;
    });
  }, [measurementGroupRef]);

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    containerWidthRef.current = width;
    containerHeightRef.current = height;

    // Scene
    const newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0xFAFAFA);
    setScene(newScene);

    // Camera
    const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    newCamera.position.set(0, 2, 5);
    setCamera(newCamera);

    // Renderer
    const newRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    newRenderer.setSize(width, height);
    newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(newRenderer.domElement);
    setRenderer(newRenderer);

    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    newScene.add(ambientLight);

    // Directional Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    newScene.add(directionalLight);

    // Measurement Group
    const newMeasurementGroup = new THREE.Group();
    newScene.add(newMeasurementGroup);
    measurementGroupRef.current = newMeasurementGroup;

    // Initial Grid Helper
    const gridHelper = new THREE.GridHelper(10, 10);
    newScene.add(gridHelper);

    setLoadedModel(null);

    return { newScene, newCamera, newRenderer };
  }, [containerRef]);

  useEffect(() => {
    const { newScene, newCamera, newRenderer } = initScene();

    const handleResize = () => {
      if (!containerRef.current || !newCamera || !newRenderer) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      containerWidthRef.current = width;
      containerHeightRef.current = height;

      newCamera.aspect = width / height;
      newCamera.updateProjectionMatrix();
      newRenderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (newScene) newScene.dispose();
      if (newCamera) {
        newCamera.remove();
      }
      if (newRenderer) {
        newRenderer.dispose();
        if (containerRef.current && containerRef.current.contains(newRenderer.domElement)) {
          containerRef.current.removeChild(newRenderer.domElement);
        }
      }
    };
  }, [containerRef, initScene]);

  useFrame(() => {
    if (scene && camera && renderer) {
      renderer.render(scene, camera);

      // Update label scales for all measurements
      measurements.forEach(measurement => {
        if (measurement.labelObject) {
          updateLabelScale(measurement.labelObject, camera);
        }
      });
    }
  });

  const loadModel = useCallback(async (file: File) => {
    setIsLoading(true);
    setProgress(0);
    setError(null);

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const gltfLoader = new GLTFLoader();
          const dracoLoader = new DRACOLoader();
          dracoLoader.setDecoderPath('/draco/');
          gltfLoader.setDRACOLoader(dracoLoader);

          gltfLoader.load(
            'data:model/gltf-binary;base64,' + btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))),
            (gltf) => {
              if (!scene || !camera || !renderer) {
                const { newScene, newCamera, newRenderer } = initScene();
                if (!newScene || !newCamera || !newRenderer) {
                  throw new Error("Failed to initialize scene, camera, or renderer.");
                }
                setScene(newScene);
                setCamera(newCamera);
                setRenderer(newRenderer);
              }

              // Remove existing model
              if (loadedModel) {
                scene!.remove(loadedModel);
                setLoadedModel(null);
              }

              const model = gltf.scene;
              scene!.add(model);

              // Bounding Box
              const box = new THREE.Box3().setFromObject(model);
              const size = box.getSize(new THREE.Vector3()).length();
              const center = box.getCenter(new THREE.Vector3());

              // Update Camera
              camera!.position.copy(center);
              camera!.position.x += size / 2.0;
              camera!.position.y += size / 5.0;
              camera!.position.z += size / 2.0;
              camera!.lookAt(center);

              setLoadedModel(model);
              setMeasurements([]);
              undoHistoryRef.current = [];
              setCanUndo(false);
              
              // Clear existing measurement group and create a new one
              if (measurementGroupRef.current) {
                scene!.remove(measurementGroupRef.current);
              }
              const newMeasurementGroup = new THREE.Group();
              scene!.add(newMeasurementGroup);
              measurementGroupRef.current = newMeasurementGroup;

              if (onLoadComplete) {
                onLoadComplete();
              }
              
              resolve();
            },
            (xhr) => {
              const loadingProgress = Math.round((xhr.loaded / xhr.total) * 100);
              setProgress(loadingProgress);
            },
            (error) => {
              console.error('Error loading GLTF model:', error);
              setError('Fehler beim Laden des Modells.');
              reject(error);
            }
          );
        } catch (err) {
          console.error('Error processing model file:', err);
          setError('Fehler beim Verarbeiten der Modelldatei.');
          reject(err);
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Fehler beim Lesen der Datei.');
        setIsLoading(false);
        reject(new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(file);
    });
  }, [initScene, onLoadComplete, loadedModel, scene, camera]);

  const resetView = useCallback(() => {
    if (!loadedModel || !camera) return;

    const box = new THREE.Box3().setFromObject(loadedModel);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    camera.position.copy(center);
    camera.position.x += size / 2.0;
    camera.position.y += size / 5.0;
    camera.position.z += size / 2.0;
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }, [loadedModel, camera]);

  const recordState = useCallback(() => {
    undoHistoryRef.current.push(JSON.parse(JSON.stringify(measurements)));
    if (undoHistoryRef.current.length > 10) {
      undoHistoryRef.current.shift();
    }
    setCanUndo(undoHistoryRef.current.length > 0);
  }, [measurements]);

  const undoLastPoint = useCallback(() => {
    if (undoHistoryRef.current.length === 0) return;

    const lastState = undoHistoryRef.current.pop();
    setMeasurements(lastState || []);
    setCanUndo(undoHistoryRef.current.length > 0);

    // Update visibility of measurements based on the restored state
    if (measurementGroupRef.current) {
      measurementGroupRef.current.children.forEach(child => {
        if (child.userData && child.userData.measurementId) {
          const measurement = lastState?.find(m => m.id === child.userData.measurementId);
          child.visible = measurement?.visible !== false;
        }
      });
    }
  }, []);

  const clearMeasurements = useCallback(() => {
    setMeasurements([]);
    undoHistoryRef.current = [];
    setCanUndo(false);

    if (measurementGroupRef.current) {
      // Dispose of all children in the measurement group
      measurementGroupRef.current.children.forEach(child => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Sprite) {
          if (child.material instanceof THREE.SpriteMaterial && child.material.map) {
            child.material.map.dispose();
          }
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        } else if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });

      // Remove all children from the measurement group
      while (measurementGroupRef.current.children.length > 0) {
        measurementGroupRef.current.remove(measurementGroupRef.current.children[0]);
      }
    }
  }, []);

  const deleteMeasurement = useCallback((id: string) => {
    setMeasurements(prevMeasurements => {
      const updatedMeasurements = prevMeasurements.filter(m => m.id !== id);
      return updatedMeasurements;
    });

    if (measurementGroupRef.current) {
      measurementGroupRef.current.children.forEach(child => {
        if (child.userData && child.userData.measurementId === id) {
          measurementGroupRef.current!.remove(child);

          // Dispose of the geometry and material if they exist
          if (child instanceof THREE.Line) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Sprite) {
            if (child.material instanceof THREE.SpriteMaterial && child.material.map) {
              child.material.map.dispose();
            }
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          } else if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        }
      });
    }
  }, []);

  const updateMeasurement = useCallback((id: string, data: Partial<Measurement>) => {
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(m => {
        if (m.id === id) {
          return { ...m, ...data };
        }
        return m;
      });
    });
  }, []);

  const toggleMeasurementsVisibility = useCallback((visible: boolean) => {
    if (!measurementGroupRef.current) return;

    measurementGroupRef.current.children.forEach(child => {
      if (child.userData && child.userData.measurementId) {
        child.visible = visible;
      }
    });
  }, []);

  const handleSceneClick = useCallback((event: MouseEvent) => {
    if (!loadedModel || !scene || !camera || !renderer || !measurementGroupRef.current) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
    const intersects = raycaster.intersectObjects(loadedModel.children, true);

    if (activeTool !== 'none' && intersects.length > 0) {
      const intersectPoint = intersects[0].point.clone();
      
      // Füge den temporären Punkt sowohl zum State als auch visuell zur Szene hinzu
      const newPoint = {
        position: intersectPoint.clone(),
        worldPosition: intersectPoint.clone()
      };
      
      setTempPoints(prev => {
        const newPoints = [...(prev || []), newPoint];
        
        // Visuellen Punkt erstellen und zur Szene hinzufügen
        if (measurementGroupRef.current) {
          const pointGeometry = new THREE.SphereGeometry(0.15, 16, 16);
          const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
          const point = new THREE.Mesh(pointGeometry, pointMaterial);
          point.position.copy(intersectPoint);
          point.name = `temp-point-${newPoints.length - 1}`;
          
          measurementGroupRef.current.add(point);
          
          // Speichern der Referenz auf den visuellen Punkt
          tempPointsRef.current = [...(tempPointsRef.current || []), point];
        }
        
        return newPoints;
      });

      setMeasurements(prevMeasurements => {
        let currentMeasurement = prevMeasurements.find(m => m.isActive);

        if (!currentMeasurement) {
          const newMeasurement: Measurement = {
            id: createMeasurementId(),
            type: activeTool,
            points: [{ position: intersectPoint, worldPosition: intersectPoint }],
            value: 0,
            unit: 'm',
            visible: true,
            editMode: false,
          };
          
          recordState();
          
          return [...prevMeasurements, newMeasurement];
        } else {
          const updatedPoints = [...currentMeasurement.points, { position: intersectPoint, worldPosition: intersectPoint }];
          
          if (updatedPoints.length === 2 && currentMeasurement.type === 'length') {
            const p1 = updatedPoints[0].position;
            const p2 = updatedPoints[1].position;
            const distance = calculateDistance(p1, p2);
            
            const lineGeometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData = { measurementId: currentMeasurement.id };
            measurementGroupRef.current!.add(line);
            
            const labelText = `${distance.toFixed(2)} m`;
            const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            midpoint.y += 0.1;
            const label = createTextSprite(labelText, midpoint, 0x00ff00);
            label.userData = { measurementId: currentMeasurement.id };
            measurementGroupRef.current!.add(label);
            
            const updatedMeasurement = {
              ...currentMeasurement,
              points: updatedPoints,
              value: distance,
              isActive: false,
              labelObject: label,
              lineObjects: [line],
              pointObjects: updatedPoints.map((point, index) => {
                const pointGeometry = new THREE.SphereGeometry(0.1, 32, 32);
                const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
                pointMesh.position.copy(point.position);
                pointMesh.name = `point-${currentMeasurement.id}-${index}`;
                pointMesh.userData = { measurementId: currentMeasurement.id };
                measurementGroupRef.current!.add(pointMesh);
                return pointMesh;
              })
            };
            
            recordState();
            
            return prevMeasurements.map(m => m.id === currentMeasurement.id ? updatedMeasurement : m);
          } else {
            return prevMeasurements;
          }
        }
      });
    }
  }, [activeTool, loadedModel, scene, camera, renderer, calculateDistance, createMeasurementId, recordState]);

  useEffect(() => {
    if (renderer && renderer.domElement) {
      renderer.domElement.addEventListener('click', handleSceneClick);
    }

    return () => {
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener('click', handleSceneClick);
      }
    };
  }, [renderer, handleSceneClick]);

  // Stelle sicher, dass tempPointsRef initialisiert wird
  useEffect(() => {
    tempPointsRef.current = [];
  }, []);

  return {
    loadedModel,
    scene,
    camera,
    renderer,
    activeTool,
    measurements,
    canUndo,
    error,
    isLoading,
    progress,
    tempPoints,
    measurementGroupRef,
    setActiveTool,
    setMeasurements,
    loadModel,
    resetView,
    undoLastPoint,
    clearMeasurements,
    deleteMeasurement,
    updateMeasurement,
    toggleMeasurementsVisibility,
    initScene,
    setProgress,
    deleteTempPoint
  };
};

export default useModelViewer;
