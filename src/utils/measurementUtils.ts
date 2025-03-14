import * as THREE from 'three';

export type MeasurementType = 'length' | 'height' | 'area' | 'none';

export interface MeasurementPoint {
  position: THREE.Vector3;
  worldPosition: THREE.Vector3;
}

export interface Measurement {
  id: string;
  type: MeasurementType;
  points: MeasurementPoint[];
  value: number;
  unit: string;
  inclination?: number; // Neigungswinkel in Grad
  description?: string;
  isActive?: boolean;
  visible?: boolean;
  editMode?: boolean; // Neues Feld für den Bearbeitungsmodus
  labelObject?: THREE.Sprite; // Reference to the 3D label
  lineObjects?: THREE.Line[]; // References to the 3D lines
  pointObjects?: THREE.Mesh[]; // References to the 3D points
}

// Calculate distance between two points in 3D space
export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

// Calculate height difference (y-axis) between two points
export const calculateHeight = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return Math.abs(p2.y - p1.y);
};

// Calculate inclination angle in degrees between two points
export const calculateInclination = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  // Berechne horizontale Distanz (XZ-Ebene)
  const horizontalDistance = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z).length();
  
  // Berechne Höhendifferenz
  const heightDifference = Math.abs(p2.y - p1.y);
  
  // Berechne Neigungswinkel in Grad
  const angleInRadians = Math.atan2(heightDifference, horizontalDistance);
  const angleInDegrees = THREE.MathUtils.radToDeg(angleInRadians);
  
  return parseFloat(angleInDegrees.toFixed(1));
};

// Prüft, ob die Neigung signifikant genug ist, um angezeigt zu werden
export const isInclinationSignificant = (inclination: number, threshold: number = 5.0): boolean => {
  return inclination >= threshold;
};

// Format measurement value with appropriate unit
export const formatMeasurement = (value: number, type: MeasurementType): string => {
  return `${value.toFixed(2)} m`;
};

// Format measurement with inclination
export const formatMeasurementWithInclination = (
  value: number, 
  inclination: number | undefined
): string => {
  if (inclination !== undefined && isInclinationSignificant(inclination)) {
    return `${value.toFixed(2)} m | ${inclination.toFixed(1)}°`;
  }
  return `${value.toFixed(2)} m`;
};

// Create a unique ID for measurements
export const createMeasurementId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

// Calculate area using the Gauss formula (Shoelace formula)
export const calculateArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  // Project points onto the XZ plane (assuming Y is up)
  const projectedPoints = points.map(p => new THREE.Vector2(p.x, p.z));
  
  let area = 0;
  for (let i = 0; i < projectedPoints.length; i++) {
    const j = (i + 1) % projectedPoints.length;
    area += projectedPoints[i].x * projectedPoints[j].y;
    area -= projectedPoints[j].x * projectedPoints[i].y;
  }
  
  // Calculate the absolute value and divide by 2
  return Math.abs(area) / 2;
};

// Format area measurement value
export const formatAreaMeasurement = (value: number): string => {
  return `${value.toFixed(2)} m²`;
};

// Create or remove a temporary point visual representation
export const createTempPointVisual = (point: MeasurementPoint, index: number): THREE.Mesh => {
  const pointGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const pointMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff0000,
    opacity: 0.9,
    transparent: true 
  });
  
  const pointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
  pointMesh.position.copy(point.position);
  pointMesh.name = `temp-point-${index}`;
  
  // Add userData to identify as temporary point
  pointMesh.userData = {
    isTemporaryPoint: true,
    pointIndex: index
  };
  
  return pointMesh;
};

// Remove temporary point visual from scene
export const removeTempPointVisual = (scene: THREE.Group, index: number): void => {
  const pointName = `temp-point-${index}`;
  
  scene.traverse((object) => {
    if (object.name === pointName) {
      if (object.parent) {
        object.parent.remove(object);
      }
      
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material && Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else if (object.material) {
          object.material.dispose();
        }
      }
    }
  });
};

// Create a text sprite for measurement labels
export const createTextSprite = (text: string, position: THREE.Vector3, color: number = 0xffffff): THREE.Sprite => {
  // Create canvas for texture
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not get canvas context");
  
  // Increase canvas size for better resolution
  canvas.width = 512; 
  canvas.height = 128;
  
  // Define gradients and colors
  const bgGradient = context.createLinearGradient(0, 0, canvas.width, 0);
  bgGradient.addColorStop(0, 'rgba(41, 50, 65, 0.95)');
  bgGradient.addColorStop(1, 'rgba(27, 32, 43, 0.95)');
  
  // Draw a rounded rectangle with gradient background
  context.fillStyle = bgGradient;
  context.roundRect(0, 0, canvas.width, canvas.height, 16);
  context.fill();
  
  // Add subtle border for better visibility
  context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  context.lineWidth = 2;
  context.roundRect(2, 2, canvas.width-4, canvas.height-4, 14);
  context.stroke();
  
  // Add a subtle inner glow
  context.shadowColor = 'rgba(0, 148, 255, 0.3)';
  context.shadowBlur = 8;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  
  // Use the Inter font which is used in the UI (from index.css)
  context.font = 'bold 48px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // Remove text shadow to make text cleaner
  context.shadowColor = 'transparent';
  
  // Draw text with a light gradient fill for better legibility
  const textGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  textGradient.addColorStop(0, '#ffffff');
  textGradient.addColorStop(1, '#e0e0e0');
  
  context.fillStyle = textGradient;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create sprite material with canvas texture
  const texture = new THREE.CanvasTexture(canvas);
  
  // Apply texture filtering for clearer text
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    sizeAttenuation: true,
    depthTest: false,
    depthWrite: false,
    transparent: true
  });
  
  // Create sprite and position it
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  // Scale the sprite - initial scale will be adjusted dynamically based on camera distance
  sprite.scale.set(0.8, 0.4, 1);
  
  // Add custom property to store base scale for dynamic scaling
  sprite.userData = {
    baseScale: { x: 0.8, y: 0.4, z: 1 },
    isLabel: true
  };
  
  return sprite;
};

// Update sprite scale based on camera distance
export const updateLabelScale = (sprite: THREE.Sprite, camera: THREE.Camera): void => {
  if (!sprite.userData.baseScale) return;
  
  // Get distance from camera to sprite
  const distance = camera.position.distanceTo(sprite.position);
  
  // Calculate scale factor based on distance
  // This ensures labels maintain readable size regardless of zoom level
  const scaleFactor = Math.max(0.8, distance * 0.15);
  
  // Apply scale based on base scale and distance
  sprite.scale.set(
    sprite.userData.baseScale.x * scaleFactor,
    sprite.userData.baseScale.y * scaleFactor,
    1
  );
};

// Deutlich verbesserte visuelle Darstellung im Editiermodus
export const createEditablePointMaterial = (isSelected: boolean = false): THREE.MeshBasicMaterial => {
  // Auffälligere, intensive Farbe für Editiermodus
  return new THREE.MeshBasicMaterial({ 
    color: isSelected ? 0x00ff00 : 0xff00ff, // Magenta für bearbeitbare Punkte
    opacity: 0.9,
    transparent: true
  });
};

// Standard-Punktmaterial, wenn nicht im Editiermodus
export const createDraggablePointMaterial = (isHovered: boolean = false, isSelected: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({ 
    color: isSelected ? 0x00ff00 : (isHovered ? 0xffff00 : 0xff0000),
    opacity: isHovered ? 0.8 : 1.0,
    transparent: true
  });
};

// Create draggable measurement point with increased size for better touch interaction
export const createDraggablePoint = (position: THREE.Vector3, name: string): THREE.Mesh => {
  // Normale Größe für nicht-editierbare Punkte
  const pointGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const pointMaterial = createDraggablePointMaterial();
  const point = new THREE.Mesh(pointGeometry, pointMaterial);
  point.position.copy(position);
  point.name = name;
  
  // Add custom userData to track interaction state
  point.userData = {
    isDraggable: true,
    lastClickTime: 0,
    isBeingDragged: false,
    isSelected: false,
    isEditable: false,
    originalScale: new THREE.Vector3(1, 1, 1)
  };
  
  return point;
};

// Create area measurement with multiple points
export const createAreaMeasurement = (points: MeasurementPoint[]): Measurement => {
  const id = createMeasurementId();
  const areaValue = calculateArea(points.map(p => p.position));
  
  return {
    id,
    type: 'area',
    points,
    value: areaValue,
    unit: 'm²',
    visible: true,
    isActive: false
  };
};

// Create measurement line with increased thickness
export const createMeasurementLine = (points: THREE.Vector3[], color: number = 0x00ff00): THREE.Line => {
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: color,
    linewidth: 8,
    opacity: 0.9,
    transparent: true,
  });
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(lineGeometry, lineMaterial);
};

// Create closed area polygon line
export const createAreaPolygon = (points: THREE.Vector3[], color: number = 0x0066ff): THREE.Line => {
  // Create a closed loop by adding the first point at the end
  const polygonPoints = [...points];
  if (points.length > 2) {
    polygonPoints.push(points[0].clone());
  }
  
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: color,
    linewidth: 2,
    opacity: 0.8,
    transparent: true,
  });
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(polygonPoints);
  return new THREE.Line(lineGeometry, lineMaterial);
};

// Update a measurement line with new points
export const updateMeasurementLine = (line: THREE.Line, points: THREE.Vector3[]): void => {
  if (line && line.geometry) {
    // Update the line geometry with new points
    line.geometry.dispose(); // Clean up old geometry
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
};

// Update area polygon with new points
export const updateAreaPolygon = (line: THREE.Line, points: THREE.Vector3[]): void => {
  if (line && line.geometry) {
    // Create a closed loop by adding the first point at the end
    const polygonPoints = [...points];
    if (points.length > 2) {
      polygonPoints.push(points[0].clone());
    }
    
    // Update the line geometry with new points
    line.geometry.dispose(); // Clean up old geometry
    line.geometry = new THREE.BufferGeometry().setFromPoints(polygonPoints);
  }
};

// Helper to check if an interaction is a double-click/tap
export const isDoubleClick = (currentTime: number, lastClickTime: number): boolean => {
  const doubleClickThreshold = 500; // 500ms for better touch response
  return (currentTime - lastClickTime) < doubleClickThreshold;
};

// Toggle point selection state
export const togglePointSelection = (point: THREE.Mesh): boolean => {
  if (!point.userData) point.userData = {};
  
  // Toggle the selection state
  point.userData.isSelected = !point.userData.isSelected;
  
  // Update the material based on the new selection state
  if (point.material instanceof THREE.MeshBasicMaterial) {
    point.material.dispose();
    
    if (point.userData.isEditable) {
      point.material = createEditablePointMaterial(point.userData.isSelected);
    } else {
      point.material = createDraggablePointMaterial(false, point.userData.isSelected);
    }
  }
  
  return point.userData.isSelected;
};

// Check if a point is currently selected
export const isPointSelected = (point: THREE.Mesh): boolean => {
  return point.userData?.isSelected === true;
};

// Highlight measurement points for edit mode - WITHOUT ENLARGING THE POINTS
export const highlightMeasurementPoints = (
  measurement: Measurement, 
  scene: THREE.Group, 
  highlight: boolean
): void => {
  if (!measurement.pointObjects) return;
  
  measurement.pointObjects.forEach((point) => {
    if (point instanceof THREE.Mesh && point.material instanceof THREE.MeshBasicMaterial) {
      // Store original material if entering edit mode
      if (highlight && !point.userData.originalMaterial) {
        point.userData.originalMaterial = point.material.clone();
      }
      
      // Apply appropriate material and update editable state
      if (highlight) {
        // Set edit mode flag
        point.userData.isEditable = true;
        
        // Switch to edit mode color without changing size
        point.material.dispose();
        point.material = createEditablePointMaterial(false);
        
        // Set user cursor style
        document.body.style.cursor = 'grab';
      } else {
        // Deactivate edit mode
        point.userData.isEditable = false;
        
        // Reset cursor
        document.body.style.cursor = 'auto';
        
        // Restore original material when exiting edit mode
        if (point.userData.originalMaterial) {
          point.material.dispose();
          point.material = point.userData.originalMaterial;
          point.userData.originalMaterial = null;
        }
      }
    }
  });
};

// Vergrößerter Hittest-Radius für bessere Erkennung
export const getPointHitTestRadius = (): number => {
  return 0.3; // Deutlich größerer Bereich als die visuelle Größe des Punktes
};

// Neuer Helfer: Zeige "Kann ziehen"-Cursor, wenn über editierbarem Punkt
export const updateCursorForDraggablePoint = (isOverDraggablePoint: boolean, isDragging: boolean = false): void => {
  if (isOverDraggablePoint) {
    document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
  } else {
    document.body.style.cursor = 'auto';
  }
};

// Verbesserte Version: Finde den nächsten Punkt innerhalb des Hit-Radius
export const findNearestEditablePoint = (
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  mousePosition: THREE.Vector2,
  scene: THREE.Group,
  hitRadius: number = 0.4 // Erhöhter Radius für bessere Erkennung
): THREE.Mesh | null => {
  // Aktualisiere Raycaster mit aktueller Mausposition
  raycaster.setFromCamera(mousePosition, camera);
  
  // Suche nach Schnittpunkten mit der Szene
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  // Wenn ein Punkt direkt getroffen wurde
  for (const intersect of intersects) {
    const object = intersect.object;
    if (object instanceof THREE.Mesh && 
        object.userData && 
        object.userData.isDraggable && 
        object.userData.isEditable) {
      // Direkter Treffer gefunden
      console.log('Direct hit on editable point:', object.name);
      return object;
    }
  }
  
  // Wenn kein direkter Treffer, suche nach Punkten in der Nähe
  const possiblePoints: {point: THREE.Mesh, distance: number}[] = [];
  
  // Iteriere durch alle Kinder der Szene
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && 
        object.userData && 
        object.userData.isDraggable && 
        object.userData.isEditable) {
      
      // Berechne die Bildschirmposition des Punktes
      const pointPosition = new THREE.Vector3();
      object.getWorldPosition(pointPosition);
      
      const screenPosition = pointPosition.clone().project(camera);
      
      // Berechne die Distanz zur Mausposition auf dem Bildschirm
      const distance = Math.sqrt(
        Math.pow(screenPosition.x - mousePosition.x, 2) + 
        Math.pow(screenPosition.y - mousePosition.y, 2)
      );
      
      // Wenn der Punkt innerhalb des Hit-Radius liegt, füge ihn zur Liste hinzu
      if (distance < hitRadius) {
        possiblePoints.push({point: object, distance});
        console.log('Found nearby point:', object.name, 'with distance:', distance);
      }
    }
  });
  
  // Sortiere die Punkte nach Distanz und gib den nächsten zurück
  if (possiblePoints.length > 0) {
    possiblePoints.sort((a, b) => a.distance - b.distance);
    console.log('Selected nearest point:', possiblePoints[0].point.name);
    return possiblePoints[0].point;
  }
  
  return null;
};

// Update the measurement lines and label
export const updateMeasurementGeometry = (measurement: Measurement): void => {
  if (!measurement.points || measurement.points.length < 2) return;
  
  // Update lines if they exist
  if (measurement.lineObjects && measurement.lineObjects.length > 0) {
    // For a simple line between two points (length measurement)
    if (measurement.type === 'length' && measurement.points.length === 2) {
      const linePoints = [
        measurement.points[0].position.clone(),
        measurement.points[1].position.clone()
      ];
      updateMeasurementLine(measurement.lineObjects[0], linePoints);
    }
    // For area measurements
    else if (measurement.type === 'area' && measurement.lineObjects.length === 1) {
      const polygonPoints = measurement.points.map(p => p.position.clone());
      updateAreaPolygon(measurement.lineObjects[0], polygonPoints);
    }
    // For more complex measurements with multiple lines
    else if (measurement.lineObjects.length === measurement.points.length - 1) {
      for (let i = 0; i < measurement.points.length - 1; i++) {
        const linePoints = [
          measurement.points[i].position.clone(), 
          measurement.points[i+1].position.clone()
        ];
        updateMeasurementLine(measurement.lineObjects[i], linePoints);
      }
    }
  }
  
  // Recalculate measurement value based on type
  if (measurement.points.length >= 2) {
    // Update the value based on the measurement type
    if (measurement.type === 'length') {
      measurement.value = calculateDistance(
        measurement.points[0].position,
        measurement.points[1].position
      );
      
      // Update inclination for length measurements
      measurement.inclination = calculateInclination(
        measurement.points[0].position,
        measurement.points[1].position
      );
      
      // Update the label text with the new value and inclination
      if (measurement.labelObject && measurement.labelObject.material instanceof THREE.SpriteMaterial) {
        const labelText = formatMeasurementWithInclination(measurement.value, measurement.inclination);
        
        // Get the current position to maintain it
        const currentPosition = measurement.labelObject.position.clone();
        
        // Calculate the updated midpoint
        const midpoint = new THREE.Vector3().addVectors(
          measurement.points[0].position,
          measurement.points[1].position
        ).multiplyScalar(0.5);
        
        // Add a small offset above the line for better visibility
        midpoint.y += 0.1;
        
        // Update the sprite with the new text and position
        const updatedSprite = createTextSprite(
          labelText,
          midpoint,
          0x00ff00
        );
        
        // Preserve the userData and scale from the existing label
        updatedSprite.userData = measurement.labelObject.userData;
        updatedSprite.scale.copy(measurement.labelObject.scale);
        
        // Replace the old label with the new one
        if (measurement.labelObject.parent) {
          const parent = measurement.labelObject.parent;
          if (measurement.labelObject.material.map) {
            measurement.labelObject.material.map.dispose();
          }
          measurement.labelObject.material.dispose();
          parent.remove(measurement.labelObject);
          parent.add(updatedSprite);
          measurement.labelObject = updatedSprite;
        }
      }
    } 
    else if (measurement.type === 'height') {
      measurement.value = calculateHeight(
        measurement.points[0].position,
        measurement.points[1].position
      );
      
      // Update the label text with the new height value
      if (measurement.labelObject && measurement.labelObject.material instanceof THREE.SpriteMaterial) {
        const labelText = `${measurement.value.toFixed(2)} ${measurement.unit}`;
        
        // Calculate the updated vertical midpoint
        const midHeight = (measurement.points[0].position.y + measurement.points[1].position.y) / 2;
        const midPoint = new THREE.Vector3(
          measurement.points[0].position.x,
          midHeight,
          measurement.points[0].position.z
        );
        midPoint.x += 0.1;
        
        // Update the sprite with the new text and position
        const updatedSprite = createTextSprite(
          labelText,
          midPoint,
          0x0000ff
        );
        
        // Preserve the userData and scale from the existing label
        updatedSprite.userData = measurement.labelObject.userData;
        updatedSprite.scale.copy(measurement.labelObject.scale);
        
        // Replace the old label with the new one
        if (measurement.labelObject.parent) {
          const parent = measurement.labelObject.parent;
          if (measurement.labelObject.material.map) {
            measurement.labelObject.material.map.dispose();
          }
          measurement.labelObject.material.dispose();
          parent.remove(measurement.labelObject);
          parent.add(updatedSprite);
          measurement.labelObject = updatedSprite;
        }
      }
    }
    else if (measurement.type === 'area' && measurement.points.length >= 3) {
      // Calculate area for area measurements
      measurement.value = calculateArea(measurement.points.map(p => p.position));
      
      // Update the label text with the new area value
      if (measurement.labelObject && measurement.labelObject.material instanceof THREE.SpriteMaterial) {
        const labelText = formatAreaMeasurement(measurement.value);
        
        // Calculate the centroid of the polygon for label placement
        const centroid = new THREE.Vector3();
        measurement.points.forEach(p => {
          centroid.add(p.position);
        });
        centroid.divideScalar(measurement.points.length);
        
        // Add a small offset above the area for better visibility
        centroid.y += 0.1;
        
        // Update the sprite with the new text and position
        const updatedSprite = createTextSprite(
          labelText,
          centroid,
          0x0066ff
        );
        
        // Preserve the userData and scale from the existing label
        updatedSprite.userData = measurement.labelObject.userData;
        updatedSprite.scale.copy(measurement.labelObject.scale);
        
        // Replace the old label with the new one
        if (measurement.labelObject.parent) {
          const parent = measurement.labelObject.parent;
          if (measurement.labelObject.material.map) {
            measurement.labelObject.material.map.dispose();
          }
          measurement.labelObject.material.dispose();
          parent.remove(measurement.labelObject);
          parent.add(updatedSprite);
          measurement.labelObject = updatedSprite;
        }
      }
    }
  }
  
  // Update label position if it exists
  if (measurement.labelObject) {
    // For two-point measurements, place label in the middle
    if (measurement.type === 'length' && measurement.points.length === 2) {
      const midpoint = new THREE.Vector3().addVectors(
        measurement.points[0].position,
        measurement.points[1].position
      ).multiplyScalar(0.5);
      
      // Add a small offset above the line for better visibility
      midpoint.y += 0.1;
      measurement.labelObject.position.copy(midpoint);
    }
    // For area measurements, place in the centroid
    else if (measurement.type === 'area' && measurement.points.length >= 3) {
      // Calculate the centroid of the polygon for label placement
      const centroid = new THREE.Vector3();
      measurement.points.forEach(p => {
        centroid.add(p.position);
      });
      centroid.divideScalar(measurement.points.length);
      
      // Add a small offset above the area for better visibility
      centroid.y += 0.1;
      measurement.labelObject.position.copy(centroid);
    }
    // For multi-point measurements, place near the last point
    else if (measurement.points.length > 2) {
      const lastPoint = measurement.points[measurement.points.length - 1].position;
      const offsetPosition = lastPoint.clone().add(new THREE.Vector3(0, 0.1, 0));
      measurement.labelObject.position.copy(offsetPosition);
    }
  }
}
