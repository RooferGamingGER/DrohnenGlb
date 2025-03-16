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

// Ensure polygon is closed by adding first point to the end if needed
export const ensureClosedPolygon = (points: THREE.Vector3[]): THREE.Vector3[] => {
  if (points.length < 3) return points;
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  // Überprüfen, ob der letzte Punkt mit dem ersten identisch ist
  const isClosed = firstPoint.distanceTo(lastPoint) < 0.001;
  
  // Wenn nicht geschlossen, füge den ersten Punkt am Ende hinzu
  if (!isClosed) {
    return [...points, firstPoint.clone()];
  }
  
  // Polygon ist bereits geschlossen
  return points;
};

// Calculate area of a polygon defined by an array of 3D points
// Enhanced with triangle fan triangulation
export const calculatePolygonArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  // Stelle sicher, dass das Polygon geschlossen ist
  const closedPoints = ensureClosedPolygon(points);
  
  // Project points onto the best-fitting plane
  // First, find the center of mass of all points
  const center = new THREE.Vector3();
  closedPoints.forEach(p => center.add(p));
  center.divideScalar(closedPoints.length);
  
  // Find the normal of the best-fitting plane using covariance matrix
  const covariance = new THREE.Matrix3();
  closedPoints.forEach(p => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const dz = p.z - center.z;
    
    covariance.elements[0] += dx * dx; // xx
    covariance.elements[1] += dx * dy; // xy
    covariance.elements[2] += dx * dz; // xz
    covariance.elements[3] += dy * dx; // yx
    covariance.elements[4] += dy * dy; // yy
    covariance.elements[5] += dy * dz; // yz
    covariance.elements[6] += dz * dx; // zx
    covariance.elements[7] += dz * dy; // zy
    covariance.elements[8] += dz * dz; // zz
  });
  
  // Find the eigenvector corresponding to the smallest eigenvalue
  // For simplicity, we'll use a heuristic approach to approximate the normal
  // Finding the cross product of two dominant directions in the data
  const v1 = new THREE.Vector3(
    closedPoints[1].x - closedPoints[0].x,
    closedPoints[1].y - closedPoints[0].y,
    closedPoints[1].z - closedPoints[0].z
  ).normalize();
  
  const v2 = new THREE.Vector3(
    closedPoints[Math.min(2, closedPoints.length - 1)].x - closedPoints[0].x,
    closedPoints[Math.min(2, closedPoints.length - 1)].y - closedPoints[0].y,
    closedPoints[Math.min(2, closedPoints.length - 1)].z - closedPoints[0].z
  ).normalize();
  
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  
  // If the normal is too small, default to the Y-axis
  if (normal.length() < 0.1) {
    normal.set(0, 1, 0);
  }
  
  // Create a coordinate system in the plane
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(normal.dot(u)) > 0.9) {
    u.set(0, 1, 0);
  }
  
  const xAxis = new THREE.Vector3().crossVectors(normal, u).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, normal).normalize();
  
  // Project all points onto the plane
  const projectedPoints = closedPoints.map(p => {
    const offsetVector = new THREE.Vector3().subVectors(p, center);
    return new THREE.Vector2(
      offsetVector.dot(xAxis),
      offsetVector.dot(zAxis)
    );
  });
  
  // Calculate area using the shoelace formula
  let area = 0;
  for (let i = 0; i < projectedPoints.length - 1; i++) {
    area += projectedPoints[i].x * projectedPoints[i+1].y;
    area -= projectedPoints[i+1].x * projectedPoints[i].y;
  }
  
  // Add the final segment (last point to first point)
  const lastIdx = projectedPoints.length - 1;
  area += projectedPoints[lastIdx].x * projectedPoints[0].y;
  area -= projectedPoints[0].x * projectedPoints[lastIdx].y;
  
  return Math.abs(area) / 2;
};

// Format area measurement with appropriate unit
export const formatArea = (area: number): string => {
  if (area < 0.01) {
    return `${(area * 10000).toFixed(2)} cm²`;
  }
  return `${area.toFixed(2)} m²`;
};

// Create a mesh for the area polygon - now ensures closed polygon
export const createAreaMesh = (points: THREE.Vector3[]): THREE.Mesh => {
  if (points.length < 3) {
    // Return an empty mesh if fewer than 3 points
    return new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: 0x9b87f5 })
    );
  }
  
  // Stelle sicher, dass das Polygon geschlossen ist
  const closedPoints = ensureClosedPolygon(points);
  
  // Create a shape from the projected points
  const center = new THREE.Vector3();
  closedPoints.forEach(p => center.add(p));
  center.divideScalar(closedPoints.length);
  
  // Find the normal of the best-fitting plane
  const v1 = new THREE.Vector3().subVectors(closedPoints[1], closedPoints[0]).normalize();
  const v2 = new THREE.Vector3().subVectors(closedPoints[Math.min(2, closedPoints.length - 1)], closedPoints[0]).normalize();
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  
  // If the normal is too small, default to the Y-axis
  if (normal.length() < 0.1) {
    normal.set(0, 1, 0);
  }
  
  // Create a matrix to transform points to the XZ plane
  const lookAtMatrix = new THREE.Matrix4();
  const tempCenter = center.clone();
  const tempTarget = tempCenter.clone().add(normal);
  const up = new THREE.Vector3(0, 1, 0);
  
  lookAtMatrix.lookAt(tempCenter, tempTarget, up);
  const rotationMatrix = new THREE.Matrix4().extractRotation(lookAtMatrix);
  
  // Project points onto the XZ plane
  const projectedPoints = closedPoints.map(p => {
    const localPoint = p.clone().sub(center);
    localPoint.applyMatrix4(rotationMatrix);
    return new THREE.Vector2(localPoint.x, localPoint.z);
  });
  
  // Create a shape from the 2D points
  const shape = new THREE.Shape();
  shape.moveTo(projectedPoints[0].x, projectedPoints[0].y);
  for (let i = 1; i < projectedPoints.length; i++) {
    shape.lineTo(projectedPoints[i].x, projectedPoints[i].y);
  }
  shape.closePath();
  
  // Create a ShapeGeometry
  const geometry = new THREE.ShapeGeometry(shape);
  
  // Transform the geometry back to 3D space
  geometry.rotateX(Math.PI / 2);
  
  const inverseRotation = rotationMatrix.clone().transpose();
  geometry.applyMatrix4(inverseRotation);
  geometry.translate(center.x, center.y, center.z);
  
  // Create a material with transparency
  const material = new THREE.MeshBasicMaterial({
    color: 0x9b87f5,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  // Create the mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.isAreaMeasurement = true;
  
  return mesh;
};

// Schließt ein Polygon indem der erste Punkt als letzter Punkt hinzugefügt wird
export const closePolygon = (points: MeasurementPoint[]): MeasurementPoint[] => {
  if (points.length < 3) return points;
  
  // Get the first and last points
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  // Check if the polygon is already closed
  const isClosed = firstPoint.position.distanceTo(lastPoint.position) < 0.001;
  
  if (isClosed) {
    return points; // Already closed
  }
  
  // Close the polygon by adding a copy of the first point at the end
  return [
    ...points,
    {
      position: firstPoint.position.clone(),
      worldPosition: firstPoint.worldPosition.clone()
    }
  ];
};

// Create a unique ID for measurements
export const createMeasurementId = (): string => {
  return Math.random().toString(36).substring(2, 10);
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

// Update a measurement line with new points
export const updateMeasurementLine = (line: THREE.Line, points: THREE.Vector3[]): void => {
  if (line && line.geometry) {
    // Update the line geometry with new points
    line.geometry.dispose(); // Clean up old geometry
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
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

// Update the measurement lines and label with improved polygon closing
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
    // For area measurements - with proper closing line
    else if (measurement.type === 'area' && measurement.points.length >= 3) {
      // Make sure we're working with a closed polygon
      const closedPoints = ensureClosedPolygon(measurement.points.map(p => p.position));
      const totalPoints = closedPoints.length;
      
      // Calculate how many lines we need
      const requiredLines = totalPoints - 1;  // For a closed polygon
      
      // Create line objects if they don't exist or if we need more
      if (!measurement.lineObjects) {
        measurement.lineObjects = [];
      }
      
      // Add more line objects if needed
      while (measurement.lineObjects.length < requiredLines) {
        const newLine = createMeasurementLine(
          [new THREE.Vector3(), new THREE.Vector3()], 
          measurement.type === 'area' ? 0x9b87f5 : 0x00ff00
        );
        measurement.lineObjects.push(newLine);
        
        // If this line has a parent, add the new line to it
        if (measurement.lineObjects[0].parent) {
          measurement.lineObjects[0].parent.add(newLine);
        }
      }
      
      // Update all the lines including closure line
      for (let i = 0; i < requiredLines; i++) {
        const linePoints = [
          measurement.points[i].position.clone(),
          measurement.points[(i + 1) % measurement.points.length].position.clone()
        ];
        
        if (i < measurement.lineObjects.length) {
          updateMeasurementLine(measurement.lineObjects[i], linePoints);
        }
      }
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
  
  // Recalculate measurement value and inclination
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
      // Make sure we have a closed polygon for area calculations
      const closedPoints = ensureClosedPolygon(measurement.points.map(p => p.position));
      
      // Calculate area with the closed polygon
      measurement.value = calculatePolygonArea(closedPoints);
      
      // Update the label
      if (measurement.labelObject && measurement.labelObject.material instanceof THREE.SpriteMaterial) {
        const labelText = formatArea(measurement.value);
        
        // Calculate the center of the polygon
        const center = new THREE.Vector3();
        closedPoints.forEach(p => center.add(p));
        center.divideScalar(closedPoints.length);
        
        // Add a small offset above the center point for better visibility
        center.y += 0.1;
        
        // Create a new sprite with the updated area
        const updatedSprite = createTextSprite(
          labelText,
          center,
          0x9b87f5
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
    if (measurement.points.length === 2) {
      const midpoint = new THREE.Vector3().addVectors(
        measurement.points[0].position,
        measurement.points[1].position
      ).multiplyScalar(0.5);
      
      // Add a small offset above the line for better visibility
      midpoint.y += 0.1;
      measurement.labelObject.position.copy(midpoint);
    }
    // For area measurements, place at the center of the polygon
    else if (measurement.type === 'area' && measurement.points.length >= 3) {
      const center = new THREE.Vector3();
      measurement.points.forEach(p => center.add(p.position));
      center.divideScalar(measurement.points.length);
      
      // Add a small offset above the center for better visibility
      center.y += 0.1;
      measurement.labelObject.position.copy(center);
    }
    // For multi-point measurements, place near the last point
    else if (measurement.points.length > 2) {
      const lastPoint = measurement.points[measurement.points.length - 1].position;
      const offsetPosition = lastPoint.clone().add(new THREE.Vector3(0, 0.1, 0));
      measurement.labelObject.position.copy(offsetPosition);
    }
  }
}
