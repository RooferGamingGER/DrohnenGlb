
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  MeasurementType,
  Measurement,
  MeasurementPoint,
  calculateDistance,
  calculateHeight,
  calculateArea,
  createMeasurementId,
  createTextSprite,
  createAreaMesh,
  updateLabelScale,
  createDraggablePointMaterial,
  createPreviewLineMaterial,
  getMeasurementColor,
  formatMeasurement
} from '@/utils/measurementUtils';

interface UseMeasurementsProps {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.MutableRefObject<any | null>;
  modelRef: React.MutableRefObject<THREE.Group | null>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const useMeasurements = ({
  sceneRef,
  cameraRef,
  controlsRef,
  modelRef,
  containerRef
}: UseMeasurementsProps) => {
  const [activeTool, setActiveTool] = useState<MeasurementType>('none');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [temporaryPoints, setTemporaryPoints] = useState<MeasurementPoint[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [previewLineVisible, setPreviewLineVisible] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  
  // Dragging state
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const draggedPointRef = useRef<THREE.Mesh | null>(null);

  // Raycasting
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const previousMouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  
  // References for measurements
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const currentMeasurementRef = useRef<{
    points: THREE.Vector3[];
    lines: THREE.Line[];
    labels: THREE.Sprite[];
    meshes: THREE.Mesh[];
    previewLine?: THREE.Line;
    previewConnector?: THREE.Line;
    areaMesh?: THREE.Mesh;
  } | null>(null);

  // Initialize measurement group
  useEffect(() => {
    if (!sceneRef.current) return;
    
    const measurementGroup = new THREE.Group();
    measurementGroup.name = "measurements";
    sceneRef.current.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;
    
    return () => {
      if (measurementGroupRef.current && sceneRef.current) {
        sceneRef.current.remove(measurementGroupRef.current);
      }
    };
  }, [sceneRef]);

  // Update canUndo state
  useEffect(() => {
    setCanUndo(temporaryPoints.length > 0);
  }, [temporaryPoints]);

  // Update preview line when mouse moves over model
  const updatePreviewLine = (currentMousePosition: THREE.Vector3) => {
    if (!measurementGroupRef.current || !currentMeasurementRef.current || temporaryPoints.length === 0) return;
    
    // Remove existing preview line
    if (currentMeasurementRef.current.previewLine) {
      measurementGroupRef.current.remove(currentMeasurementRef.current.previewLine);
      currentMeasurementRef.current.previewLine = undefined;
    }
    
    if (currentMeasurementRef.current.previewConnector) {
      measurementGroupRef.current.remove(currentMeasurementRef.current.previewConnector);
      currentMeasurementRef.current.previewConnector = undefined;
    }
    
    // Create points for the preview line
    const linePoints: THREE.Vector3[] = [];
    const lastPoint = temporaryPoints[temporaryPoints.length - 1].position;
    
    if (activeTool === 'height') {
      // For height measurements, add a vertical line
      const verticalPoint = new THREE.Vector3(
        lastPoint.x,
        currentMousePosition.y,
        lastPoint.z
      );
      
      linePoints.push(lastPoint, verticalPoint, currentMousePosition);
    } else {
      // For length measurements, just connect the points
      linePoints.push(lastPoint, currentMousePosition);
    }
    
    // Create and add the preview line
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = createPreviewLineMaterial(activeTool);
    const previewLine = new THREE.Line(lineGeometry, lineMaterial);
    previewLine.name = 'preview-line';
    measurementGroupRef.current.add(previewLine);
    
    // Store the reference
    if (currentMeasurementRef.current) {
      currentMeasurementRef.current.previewLine = previewLine;
    }
    
    // For area measurements, create a preview connector to close the polygon
    if (activeTool === 'area' && temporaryPoints.length > 1) {
      const firstPoint = temporaryPoints[0].position;
      const connectingLineGeometry = new THREE.BufferGeometry().setFromPoints([
        currentMousePosition, firstPoint
      ]);
      const connectingLine = new THREE.Line(connectingLineGeometry, lineMaterial);
      connectingLine.name = 'preview-connector';
      measurementGroupRef.current.add(connectingLine);
      
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current.previewConnector = connectingLine;
      }
      
      // Update the preview area mesh
      updatePreviewAreaMesh([...temporaryPoints.map(p => p.position), currentMousePosition]);
    }
  };

  // Update the preview area mesh
  const updatePreviewAreaMesh = (points: THREE.Vector3[]) => {
    if (!measurementGroupRef.current || !currentMeasurementRef.current || points.length < 3) return;
    
    // Remove existing preview area mesh
    if (currentMeasurementRef.current.areaMesh) {
      measurementGroupRef.current.remove(currentMeasurementRef.current.areaMesh);
      currentMeasurementRef.current.areaMesh = undefined;
    }
    
    // Create a new area mesh
    const areaMesh = createAreaMesh(points, getMeasurementColor('area'), 0.3);
    areaMesh.name = 'preview-area';
    measurementGroupRef.current.add(areaMesh);
    
    // Store the reference
    if (currentMeasurementRef.current) {
      currentMeasurementRef.current.areaMesh = areaMesh;
    }
  };

  // Handle mouse move for measurements
  const handleMouseMove = (event: MouseEvent) => {
    if (!containerRef.current) return;
    
    // Update mouse position
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Handle dragging of measurement points
    if (isDraggingPoint && draggedPointRef.current && modelRef.current && cameraRef.current) {
      event.preventDefault();
      
      // Update raycaster with current mouse position
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // Find intersection with the model
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        // Move the point to the new intersection position
        const newPosition = intersects[0].point.clone();
        
        // Update the dragged point's position
        draggedPointRef.current.position.copy(newPosition);
        
        // Update the measurement in state
        if (selectedMeasurementId !== null && selectedPointIndex !== null) {
          updateMeasurementPointPosition(
            selectedMeasurementId, 
            selectedPointIndex, 
            newPosition
          );
        }
      }
    }
    // Normal hover detection for model or measurement points
    else if (activeTool !== 'none' && modelRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point.clone();
        setHoverPoint(intersectionPoint);
        
        // Update preview line for active measurements
        if (temporaryPoints.length > 0) {
          setPreviewLineVisible(true);
          updatePreviewLine(intersectionPoint);
        }
      } else {
        setHoverPoint(null);
        setPreviewLineVisible(false);
        
        // Remove preview line when not hovering over the model
        if (measurementGroupRef.current && currentMeasurementRef.current) {
          if (currentMeasurementRef.current.previewLine) {
            measurementGroupRef.current.remove(currentMeasurementRef.current.previewLine);
            currentMeasurementRef.current.previewLine = undefined;
          }
          
          if (currentMeasurementRef.current.previewConnector) {
            measurementGroupRef.current.remove(currentMeasurementRef.current.previewConnector);
            currentMeasurementRef.current.previewConnector = undefined;
          }
          
          if (currentMeasurementRef.current.areaMesh) {
            measurementGroupRef.current.remove(currentMeasurementRef.current.areaMesh);
            currentMeasurementRef.current.areaMesh = undefined;
          }
        }
      }
    }
    // Check if we're hovering over any measurement points
    else if (activeTool === 'none' && measurementGroupRef.current && cameraRef.current) {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      // Filter for meshes only (points)
      const pointObjects = measurementGroupRef.current.children.filter(
        child => child instanceof THREE.Mesh && child.name.startsWith('point-')
      );
      
      const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
      
      if (intersects.length > 0) {
        const pointId = intersects[0].object.name;
        setHoveredPointId(pointId);
        document.body.style.cursor = 'grab';
        
        // Update the point material to show it's hoverable
        if (intersects[0].object instanceof THREE.Mesh) {
          intersects[0].object.material = createDraggablePointMaterial(true);
        }
      } else {
        if (hoveredPointId) {
          // Reset any previously hovered point material
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
    
    // Store the current mouse position for the next frame
    previousMouseRef.current.copy(mouseRef.current);
  };

  // Handle mouse down for dragging points
  const handleMouseDown = (event: MouseEvent) => {
    if (!containerRef.current || !measurementGroupRef.current) return;
    
    // Check if we're clicking on a measurement point
    if (hoveredPointId && !isDraggingPoint) {
      event.preventDefault();
      event.stopPropagation();
      
      // Find the point mesh
      const pointMesh = measurementGroupRef.current.children.find(
        child => child.name === hoveredPointId
      ) as THREE.Mesh;
      
      if (pointMesh) {
        // Start dragging
        setIsDraggingPoint(true);
        draggedPointRef.current = pointMesh;
        document.body.style.cursor = 'grabbing';
        
        // Get measurement ID and point index from the point name
        // Format: point-{measurementId}-{pointIndex}
        const nameParts = hoveredPointId.split('-');
        if (nameParts.length >= 3) {
          const measurementId = nameParts[1];
          const pointIndex = parseInt(nameParts[2], 10);
          
          setSelectedMeasurementId(measurementId);
          setSelectedPointIndex(pointIndex);
          
          // Disable orbit controls while dragging
          if (controlsRef.current) {
            controlsRef.current.enabled = false;
          }
        }
      }
    }
  };

  // Handle mouse up to end dragging
  const handleMouseUp = (event: MouseEvent) => {
    if (isDraggingPoint) {
      // Finish dragging
      setIsDraggingPoint(false);
      draggedPointRef.current = null;
      document.body.style.cursor = hoveredPointId ? 'grab' : 'auto';
      
      // Re-enable orbit controls
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      
      // Clear selection
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
    }
  };

  // Update measurement point position
  const updateMeasurementPointPosition = (
    measurementId: string,
    pointIndex: number,
    newPosition: THREE.Vector3
  ) => {
    setMeasurements(prevMeasurements => {
      return prevMeasurements.map(measurement => {
        if (measurement.id === measurementId) {
          // Create a copy of points with updated position
          const updatedPoints = [...measurement.points];
          
          if (updatedPoints[pointIndex]) {
            updatedPoints[pointIndex] = {
              ...updatedPoints[pointIndex],
              position: newPosition,
              worldPosition: newPosition.clone()
            };
          }
          
          // Calculate new measurement value
          let newValue: number;
          
          if (measurement.type === 'length') {
            newValue = calculateDistance(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          } else if (measurement.type === 'height') {
            newValue = calculateHeight(
              updatedPoints[0].position,
              updatedPoints[1].position
            );
          } else { // area
            newValue = calculateArea(
              updatedPoints.map(p => p.position)
            );
            
            // Update area mesh
            if (measurement.areaObject && measurementGroupRef.current) {
              // Remove old area mesh
              measurementGroupRef.current.remove(measurement.areaObject);
              measurement.areaObject.geometry.dispose();
              (measurement.areaObject.material as THREE.Material).dispose();
              
              // Create new area mesh
              const newAreaMesh = createAreaMesh(
                updatedPoints.map(p => p.position),
                getMeasurementColor('area')
              );
              measurementGroupRef.current.add(newAreaMesh);
              
              // Update lines connecting the points
              if (measurement.lineObjects) {
                const positions = updatedPoints.map(p => p.position);
                
                // Update each line segment
                for (let i = 0; i < positions.length; i++) {
                  const nextIndex = (i + 1) % positions.length;
                  
                  if (measurement.lineObjects[i]) {
                    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                      positions[i], positions[nextIndex]
                    ]);
                    
                    measurement.lineObjects[i].geometry.dispose();
                    measurement.lineObjects[i].geometry = lineGeometry;
                  }
                }
              }
              
              // Update label position (center of polygon)
              if (measurement.labelObject) {
                const center = new THREE.Vector3();
                for (const point of updatedPoints) {
                  center.add(point.position);
                }
                center.divideScalar(updatedPoints.length);
                center.y += 0.1; // Slightly above the surface
                
                measurement.labelObject.position.copy(center);
                
                // Update label text
                const labelText = formatMeasurement(newValue, 'area');
                
                // Create a new sprite with updated text
                const newSprite = createTextSprite(
                  labelText,
                  center,
                  getMeasurementColor('area')
                );
                
                // Copy user data and scale
                newSprite.userData = measurement.labelObject.userData;
                newSprite.scale.copy(measurement.labelObject.scale);
                
                // Replace the old sprite
                if (measurementGroupRef.current) {
                  if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
                    measurement.labelObject.material.map?.dispose();
                    measurement.labelObject.material.dispose();
                  }
                  
                  measurementGroupRef.current.remove(measurement.labelObject);
                  measurementGroupRef.current.add(newSprite);
                }
                
                return {
                  ...measurement,
                  points: updatedPoints,
                  value: newValue,
                  labelObject: newSprite,
                  areaObject: newAreaMesh
                };
              }
              
              return {
                ...measurement,
                points: updatedPoints,
                value: newValue,
                areaObject: newAreaMesh
              };
            }
          }
          
          // Update label position and text for length/height measurements
          if ((measurement.type === 'length' || measurement.type === 'height') && measurement.labelObject) {
            // Update label position
            let labelPosition: THREE.Vector3;
            
            if (measurement.type === 'length') {
              labelPosition = new THREE.Vector3().addVectors(
                updatedPoints[0].position,
                updatedPoints[1].position
              ).multiplyScalar(0.5);
              labelPosition.y += 0.1; // Slightly above the line
            } else { // height
              const midHeight = (
                updatedPoints[0].position.y + 
                updatedPoints[1].position.y
              ) / 2;
              
              labelPosition = new THREE.Vector3(
                updatedPoints[0].position.x,
                midHeight,
                updatedPoints[0].position.z
              );
              labelPosition.x += 0.1; // Slightly to the right
            }
            
            // Update sprite position
            measurement.labelObject.position.copy(labelPosition);
            
            // Update text
            const labelText = formatMeasurement(newValue, measurement.type);
            
            // Create a new sprite with updated text
            const newSprite = createTextSprite(
              labelText, 
              labelPosition,
              getMeasurementColor(measurement.type)
            );
            
            // Copy user data and scale
            newSprite.userData = measurement.labelObject.userData;
            newSprite.scale.copy(measurement.labelObject.scale);
            
            // Replace the old sprite
            if (measurementGroupRef.current) {
              if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
                measurement.labelObject.material.map?.dispose();
                measurement.labelObject.material.dispose();
              }
              
              measurementGroupRef.current.remove(measurement.labelObject);
              measurementGroupRef.current.add(newSprite);
            }
            
            // Update line positions
            if (measurement.lineObjects && measurement.lineObjects.length > 0) {
              if (measurement.type === 'length') {
                // For length, just update the start and end points
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                  updatedPoints[0].position,
                  updatedPoints[1].position
                ]);
                
                measurement.lineObjects[0].geometry.dispose();
                measurement.lineObjects[0].geometry = lineGeometry;
              } else { // height
                // For height, we have a vertical line
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

  // Handle clicking to add measurement points
  const handleMeasurementClick = (event: MouseEvent) => {
    // Skip if we're currently dragging a point
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
      
      // Add the point to temporary points
      setTemporaryPoints(prev => [...prev, { 
        position: point,
        worldPosition: worldPoint
      }]);
      
      // Add a visual point at this position
      addMeasurementPoint(point);
      
      // For length and height measurements, we only need 2 points
      if ((activeTool === 'length' || activeTool === 'height') && temporaryPoints.length === 1) {
        const newPoints = [...temporaryPoints, { position: point, worldPosition: worldPoint }];
        finalizeMeasurement(newPoints);
      }
      // For area measurements, we need at least 3 points, and clicking near the first point closes the polygon
      else if (activeTool === 'area' && temporaryPoints.length >= 2) {
        // Check if we're clicking near the first point to close the polygon
        const firstPoint = temporaryPoints[0].position;
        const distanceToFirst = point.distanceTo(firstPoint);
        
        // If we're within a threshold of the first point, close the polygon
        if (distanceToFirst < 0.2 && temporaryPoints.length >= 3) {
          // Don't add this point, just close the polygon with the existing points
          finalizeMeasurement(temporaryPoints);
        }
      }
    }
  };

  // Add a visual point to the scene
  const addMeasurementPoint = (position: THREE.Vector3) => {
    if (!measurementGroupRef.current) return;
    
    const pointGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const pointMaterial = createDraggablePointMaterial();
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.copy(position);
    
    // Set a unique name for the point so we can identify it later when dragging
    // The name will be updated with the measurement ID after finalization
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
      
      // Create a line connecting to the previous point
      const lineMaterial = createPreviewLineMaterial(activeTool);
      
      let linePoints: THREE.Vector3[];
      
      if (activeTool === 'height') {
        // For height measurements, create a vertical line
        const verticalPoint = new THREE.Vector3(
          prevPoint.x, 
          position.y,
          prevPoint.z
        );
        
        linePoints = [prevPoint, verticalPoint, position];
      } else {
        // For length and area measurements, connect points directly
        linePoints = [prevPoint, position];
      }
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      measurementGroupRef.current.add(line);
      
      if (currentMeasurementRef.current) {
        currentMeasurementRef.current.lines.push(line);
      }
      
      // Create measurement labels for length and height
      if (activeTool === 'length' || activeTool === 'height') {
        let value: number;
        let unit = 'm';
        
        if (activeTool === 'length') {
          value = calculateDistance(prevPoint, position);
          
          const midPoint = new THREE.Vector3().addVectors(prevPoint, position).multiplyScalar(0.5);
          midPoint.y += 0.1;
          
          const labelText = formatMeasurement(value, 'length');
          const labelSprite = createTextSprite(labelText, midPoint, getMeasurementColor('length'));
          
          // Make sure new sprites are correctly initialized for dynamic scaling
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
          
          const labelText = formatMeasurement(value, 'height');
          const labelSprite = createTextSprite(labelText, midPoint, getMeasurementColor('height'));
          
          // Make sure new sprites are correctly initialized for dynamic scaling
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

  // Finalize the measurement and add it to the list
  const finalizeMeasurement = (points: MeasurementPoint[]) => {
    if (activeTool === 'none' || !measurementGroupRef.current) return;
    
    // We need at least 2 points for length/height measurements
    // and at least 3 points for area measurements
    if ((activeTool === 'length' || activeTool === 'height') && points.length < 2) return;
    if (activeTool === 'area' && points.length < 3) return;
    
    let value = 0;
    let unit = activeTool === 'area' ? 'm²' : 'm';
    
    if (activeTool === 'length') {
      value = calculateDistance(points[0].position, points[1].position);
    } else if (activeTool === 'height') {
      value = calculateHeight(points[0].position, points[1].position);
    } else if (activeTool === 'area') {
      value = calculateArea(points.map(p => p.position));
    }
    
    const measurementId = createMeasurementId();
    
    // Update point names with the new measurement ID for easy identification
    if (currentMeasurementRef.current && currentMeasurementRef.current.meshes) {
      currentMeasurementRef.current.meshes.forEach((mesh, index) => {
        mesh.name = `point-${measurementId}-${index}`;
      });
    }
    
    // For area measurements, add a visual representation of the area
    let areaMesh: THREE.Mesh | undefined;
    
    if (activeTool === 'area') {
      // Create lines to connect all points in a closed loop
      if (currentMeasurementRef.current) {
        // The last temporary point to the first point line may be missing, add it
        const firstPoint = points[0].position;
        const lastPoint = points[points.length - 1].position;
        
        const lineMaterial = createPreviewLineMaterial('area');
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([lastPoint, firstPoint]);
        const closingLine = new THREE.Line(lineGeometry, lineMaterial);
        measurementGroupRef.current.add(closingLine);
        
        if (currentMeasurementRef.current.lines) {
          currentMeasurementRef.current.lines.push(closingLine);
        }
        
        // Create a filled area mesh
        areaMesh = createAreaMesh(points.map(p => p.position), getMeasurementColor('area'));
        measurementGroupRef.current.add(areaMesh);
        
        // Calculate center point for label
        const center = new THREE.Vector3();
        for (const point of points) {
          center.add(point.position);
        }
        center.divideScalar(points.length);
        center.y += 0.1; // Slightly above the surface
        
        // Create a label
        const labelText = formatMeasurement(value, 'area');
        const labelSprite = createTextSprite(labelText, center, getMeasurementColor('area'));
        
        // Initialize for dynamic scaling
        labelSprite.userData = {
          isLabel: true,
          baseScale: { x: 0.8, y: 0.4, z: 1 }
        };
        
        if (cameraRef.current) {
          updateLabelScale(labelSprite, cameraRef.current);
        }
        
        measurementGroupRef.current.add(labelSprite);
        
        if (currentMeasurementRef.current.labels) {
          currentMeasurementRef.current.labels.push(labelSprite);
        }
      }
    }
    
    // Collect all 3D objects related to this measurement
    const measurementObjects = {
      pointObjects: currentMeasurementRef.current?.meshes || [],
      lineObjects: currentMeasurementRef.current?.lines || [],
      labelObject: currentMeasurementRef.current?.labels[0] || null,
      areaObject: areaMesh
    };
    
    // Create the measurement object
    const newMeasurement: Measurement = {
      id: measurementId,
      type: activeTool,
      points: points,
      value,
      unit,
      ...measurementObjects
    };
    
    // Add to the list of measurements
    setMeasurements(prev => [...prev, newMeasurement]);
    
    // Clear temporary points and references
    setTemporaryPoints([]);
    
    // Remove preview elements
    if (measurementGroupRef.current && currentMeasurementRef.current) {
      if (currentMeasurementRef.current.previewLine) {
        measurementGroupRef.current.remove(currentMeasurementRef.current.previewLine);
      }
      
      if (currentMeasurementRef.current.previewConnector) {
        measurementGroupRef.current.remove(currentMeasurementRef.current.previewConnector);
      }
      
      if (currentMeasurementRef.current.areaMesh) {
        measurementGroupRef.current.remove(currentMeasurementRef.current.areaMesh);
      }
    }
    
    currentMeasurementRef.current = null;
  };

  // Undo the last measurement point
  const undoLastPoint = () => {
    if (temporaryPoints.length > 0) {
      // Remove the last point
      const newPoints = temporaryPoints.slice(0, -1);
      setTemporaryPoints(newPoints);
      
      if (measurementGroupRef.current && currentMeasurementRef.current) {
        // Remove the last visual point
        const lastPointIndex = currentMeasurementRef.current.meshes.length - 1;
        if (lastPointIndex >= 0) {
          const lastPoint = currentMeasurementRef.current.meshes[lastPointIndex];
          measurementGroupRef.current.remove(lastPoint);
          currentMeasurementRef.current.meshes.pop();
        }
        
        // Remove the last line
        const lastLineIndex = currentMeasurementRef.current.lines.length - 1;
        if (lastLineIndex >= 0) {
          const lastLine = currentMeasurementRef.current.lines[lastLineIndex];
          measurementGroupRef.current.remove(lastLine);
          currentMeasurementRef.current.lines.pop();
        }
        
        // Remove labels for length/height since they'll need to be recalculated
        const lastLabelIndex = currentMeasurementRef.current.labels.length - 1;
        if (lastLabelIndex >= 0) {
          const lastLabel = currentMeasurementRef.current.labels[lastLabelIndex];
          measurementGroupRef.current.remove(lastLabel);
          currentMeasurementRef.current.labels.pop();
        }
        
        // Remove preview area mesh if it exists
        if (currentMeasurementRef.current.areaMesh) {
          measurementGroupRef.current.remove(currentMeasurementRef.current.areaMesh);
          currentMeasurementRef.current.areaMesh = undefined;
        }
        
        // Remove preview connector
        if (currentMeasurementRef.current.previewConnector) {
          measurementGroupRef.current.remove(currentMeasurementRef.current.previewConnector);
          currentMeasurementRef.current.previewConnector = undefined;
        }
        
        // Remove preview line
        if (currentMeasurementRef.current.previewLine) {
          measurementGroupRef.current.remove(currentMeasurementRef.current.previewLine);
          currentMeasurementRef.current.previewLine = undefined;
        }
      }
    }
  };

  // Delete a specific measurement
  const deleteMeasurement = (id: string) => {
    const measurementToDelete = measurements.find(m => m.id === id);
    if (measurementToDelete && measurementGroupRef.current) {
      // Remove the 3D label
      if (measurementToDelete.labelObject) {
        if (measurementToDelete.labelObject.material instanceof THREE.SpriteMaterial) {
          measurementToDelete.labelObject.material.map?.dispose();
          measurementToDelete.labelObject.material.dispose();
        }
        measurementGroupRef.current.remove(measurementToDelete.labelObject);
      }
      
      // Remove the 3D lines
      if (measurementToDelete.lineObjects) {
        measurementToDelete.lineObjects.forEach(line => {
          line.geometry.dispose();
          (line.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(line);
        });
      }
      
      // Remove the 3D points
      if (measurementToDelete.pointObjects) {
        measurementToDelete.pointObjects.forEach(point => {
          point.geometry.dispose();
          (point.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(point);
        });
      }
      
      // Remove the 3D area mesh if it exists
      if (measurementToDelete.areaObject) {
        measurementToDelete.areaObject.geometry.dispose();
        (measurementToDelete.areaObject.material as THREE.Material).dispose();
        measurementGroupRef.current.remove(measurementToDelete.areaObject);
      }
      
      // Remove from the list
      setMeasurements(prev => prev.filter(m => m.id !== id));
    }
  };

  // Clear all measurements
  const clearMeasurements = () => {
    if (measurementGroupRef.current) {
      // Remove all 3D objects for each measurement
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
        
        if (measurement.areaObject) {
          measurement.areaObject.geometry.dispose();
          (measurement.areaObject.material as THREE.Material).dispose();
          measurementGroupRef.current?.remove(measurement.areaObject);
        }
      });
      
      // Remove hover point and preview elements
      const hoverPoint = measurementGroupRef.current.children.find(
        child => child.name === 'hoverPoint'
      );
      if (hoverPoint) {
        measurementGroupRef.current.remove(hoverPoint);
      }
      
      // Remove all other measurement-related objects
      if (currentMeasurementRef.current) {
        if (currentMeasurementRef.current.previewLine) {
          measurementGroupRef.current.remove(currentMeasurementRef.current.previewLine);
        }
        
        if (currentMeasurementRef.current.previewConnector) {
          measurementGroupRef.current.remove(currentMeasurementRef.current.previewConnector);
        }
        
        if (currentMeasurementRef.current.areaMesh) {
          measurementGroupRef.current.remove(currentMeasurementRef.current.areaMesh);
        }
      }
    }
    
    // Clear all state
    setMeasurements([]);
    setTemporaryPoints([]);
    currentMeasurementRef.current = null;
  };

  // Update an existing measurement's data (e.g., description)
  const updateMeasurement = (id: string, data: Partial<Measurement>) => {
    setMeasurements(prevMeasurements => 
      prevMeasurements.map(m => 
        m.id === id ? { ...m, ...data } : m
      )
    );
  };

  // Effect to handle hover point visualization
  useEffect(() => {
    if (hoverPoint && measurementGroupRef.current && activeTool !== 'none') {
      // Create or update hover point indicator
      const existingHoverPoint = measurementGroupRef.current.children.find(
        child => child.name === 'hoverPoint'
      );
      
      if (existingHoverPoint) {
        existingHoverPoint.position.copy(hoverPoint);
      } else {
        const hoverGeometry = new THREE.SphereGeometry(0.03);
        const hoverMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffff00,
          transparent: true,
          opacity: 0.5
        });
        const hoverMesh = new THREE.Mesh(hoverGeometry, hoverMaterial);
        hoverMesh.position.copy(hoverPoint);
        hoverMesh.name = 'hoverPoint';
        
        measurementGroupRef.current.add(hoverMesh);
      }
    } else if (measurementGroupRef.current) {
      // Remove hover point when not hovering
      const existingHoverPoint = measurementGroupRef.current.children.find(
        child => child.name === 'hoverPoint'
      );
      
      if (existingHoverPoint) {
        measurementGroupRef.current.remove(existingHoverPoint);
      }
    }
  }, [hoverPoint, activeTool]);

  // Effect to add/remove event listeners
  useEffect(() => {
    if (!containerRef.current) return;
    
    if (activeTool !== 'none') {
      // Add click listener for adding measurement points
      containerRef.current.addEventListener('click', handleMeasurementClick);
      
      // Disable rotation controls when measuring
      if (controlsRef.current) {
        controlsRef.current.enableRotate = false;
      }
    } else {
      // Remove listener when not measuring
      containerRef.current.removeEventListener('click', handleMeasurementClick);
      
      // Clear temporary measurements
      setTemporaryPoints([]);
      
      // Re-enable rotation
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
      }
    }
    
    // Add mouse move/drag listeners
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      // Clean up all listeners
      containerRef.current?.removeEventListener('click', handleMeasurementClick);
      containerRef.current?.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeTool, temporaryPoints, isDraggingPoint, hoveredPointId]);

  return {
    activeTool,
    setActiveTool,
    measurements,
    clearMeasurements,
    undoLastPoint,
    deleteMeasurement,
    updateMeasurement,
    canUndo,
  };
};
