import * as THREE from 'three';

export type MeasurementType = 'length' | 'height' | 'area' | 'none' | 'distance' | 'angle';

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
  visible: boolean;
  description?: string;
  editMode?: boolean;
  inclination?: number;
  labelObject?: THREE.Sprite;
  lineObjects?: THREE.Line[];
  pointObjects?: THREE.Mesh[];
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

// New: Calculate preview area for incomplete polygon
export const calculatePreviewPolygonArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  // Create a temporary closed polygon for calculation
  const previewPoints = [...points];
  
  // Create a closed polygon for area calculation
  return calculatePolygonArea(previewPoints);
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
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  // Check if we need to add a closing point (if first and last are different)
  if (firstPoint.position.distanceTo(lastPoint.position) > 0.01) {
    // Add a copy of the first point to close the polygon
    return [...points, {
      position: firstPoint.position.clone(),
      worldPosition: firstPoint.worldPosition.clone()
    }];
  }
  
  return points;
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

// Create a temporary preview text sprite for in-progress measurements
export const createPreviewTextSprite = (text: string, position: THREE.Vector3): THREE.Sprite => {
  // Similar to createTextSprite but with 'preview' styling
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not get canvas context");
  
  canvas.width = 512;
  canvas.height = 128;
  
  // More transparent background for preview
  const bgGradient = context.createLinearGradient(0, 0, canvas.width, 0);
  bgGradient.addColorStop(0, 'rgba(41, 50, 65, 0.8)');
  bgGradient.addColorStop(1, 'rgba(27, 32, 43, 0.8)');
  
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
  context.shadowColor = 'rgba(155, 135, 245, 0.5)';  // Purple glow for preview
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
    transparent: true,
    opacity: 0.85  // More transparent for preview
  });
  
  // Create sprite and position it
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  // Scale the sprite - initial scale will be adjusted dynamically based on camera distance
  sprite.scale.set(0.8, 0.4, 1);
  
  // Add custom property to store base scale for dynamic scaling
  sprite.userData = {
    baseScale: { x: 0.8, y: 0.4, z: 1 },
    isLabel: true,
    isPreview: true
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

// Create a preview line for showing the potential closure of a polygon
export const createPreviewLine = (points: THREE.Vector3[]): THREE.Line => {
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0x9b87f5,
    linewidth: 8,
    opacity: 0.6,  // More transparent for preview
    transparent: true,
  });
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.userData = { isPreviewLine: true };
  
  return line;
}

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
    if (measurement.type === 'distance' && measurement.points.length === 2) {
      const linePoints = [
        measurement.points[0].position.clone(),
        measurement.points[1].position.clone()
      ];
      updateMeasurementLine(measurement.lineObjects[0], linePoints);
    }
    // For area measurements - with proper closing line
    else if (measurement.type === 'area' && measurement.points.length >= 3) {
      // Always work with and ensure a properly closed polygon
      const positions = measurement.points.map(p => p.position);
      const closedPolygon = ensureClosedPolygon(positions);
      const totalPoints = closedPolygon.length;
      
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
          0x9b87f5 // Purple color for area measurements
        );
        measurement.lineObjects.push(newLine);
        
        // If this line has a parent, add the new line to it
        if (measurement.lineObjects[0].parent) {
          measurement.lineObjects[0].parent.add(newLine);
        }
      }
      
      // Update all the lines including the closure line
      for (let i = 0; i < requiredLines; i++) {
        const startIdx = i;
        const endIdx = (i + 1) % closedPolygon.length;
        
        const linePoints = [
          closedPolygon[startIdx].clone(),
          closedPolygon[endIdx].clone()
        ];
        updateMeasurementLine(measurement.lineObjects[i], linePoints);
      }
    }
  }
  
  // Update label if it exists
  if (measurement.labelObject) {
    // Position the label at the center of the measurement
    const center = new THREE.Vector3();
    measurement.points.forEach(point => {
      center.add(point.position);
    });
    center.divideScalar(measurement.points.length);
    
    // Offset the label slightly above the measurement
    const labelPosition = center.clone().add(new THREE.Vector3(0, 0.3, 0));
    measurement.labelObject.position.copy(labelPosition);
  }
};

// Clear all temporary preview objects
export const clearPreviewObjects = (
  measurement: Measurement, 
  scene: THREE.Group
): void => {
  // Find and remove all objects marked as previews
  const previewObjects: THREE.Object3D[] = [];
  
  scene.traverse((object) => {
    if (object.userData && 
        (object.userData.isPreview || 
         object.userData.isPreviewLine || 
         object.userData.isTemporaryPoint ||
         object.name.includes('preview-') ||
         object.name.includes('temp-') ||
         object.name === `preview-area`)) {
      previewObjects.push(object);
    }
  });
  
  // Remove all found preview objects
  previewObjects.forEach(object => {
    if (object.parent) {
      object.parent.remove(object);
    }
    
    // Dispose of resources
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    } else if (object instanceof THREE.Sprite) {
      if (object.material instanceof THREE.SpriteMaterial) {
        if (object.material.map) {
          object.material.map.dispose();
        }
        object.material.dispose();
      }
    }
  });
};

// Update area preview as points are added
export const updateAreaPreview = (
  measurement: Measurement,
  points: MeasurementPoint[],
  scene: THREE.Group,
  camera: THREE.Camera
): void => {
  if (points.length < 3) return;
  
  // Clear previous preview
  clearPreviewObjects(measurement, scene);
  
  // Create preview area
  const positions = points.map(p => p.position);
  const geometry = new THREE.BufferGeometry();
  
  // Create a shape from the points
  const shape = new THREE.Shape();
  shape.moveTo(positions[0].x, positions[0].z);
  
  for (let i = 1; i < positions.length; i++) {
    shape.lineTo(positions[i].x, positions[i].z);
  }
  
  // Close the shape
  shape.lineTo(positions[0].x, positions[0].z);
  
  // Create the fill material
  const material = new THREE.MeshBasicMaterial({
    color: 0x3498db,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  try {
    // Create geometry from shape
    const shapeGeometry = new THREE.ShapeGeometry(shape);
    
    // Rotate to match the XZ plane
    const mesh = new THREE.Mesh(shapeGeometry, material);
    mesh.rotation.x = Math.PI / 2;
    
    // Calculate the average Y value for the mesh
    let avgY = 0;
    positions.forEach(pos => {
      avgY += pos.y;
    });
    avgY /= positions.length;
    
    // Position the mesh at the average Y value
    mesh.position.y = avgY + 0.01; // Slight offset to avoid z-fighting
    
    mesh.name = 'preview-area';
    mesh.userData.isPreview = true;
    
    scene.add(mesh);
  } catch (error) {
    console.error('Error creating area preview:', error);
  }
};

// Finalize a polygon area measurement
export const finalizePolygon = (
  measurement: Measurement,
  scene: THREE.Group
): void => {
  if (measurement.type !== 'area' || measurement.points.length < 3) return;
  
  // Clear any preview objects
  clearPreviewObjects(measurement, scene);
  
  // Create final area visualization
  const positions = measurement.points.map(p => p.position);
  const shape = new THREE.Shape();
  shape.moveTo(positions[0].x, positions[0].z);
  
  for (let i = 1; i < positions.length; i++) {
    shape.lineTo(positions[i].x, positions[i].z);
  }
  
  // Close the shape
  shape.lineTo(positions[0].x, positions[0].z);
  
  // Create the fill material
  const material = new THREE.MeshBasicMaterial({
    color: 0x27ae60,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  try {
    // Create geometry from shape
    const shapeGeometry = new THREE.ShapeGeometry(shape);
    
    // Rotate to match the XZ plane
    const mesh = new THREE.Mesh(shapeGeometry, material);
    mesh.rotation.x = Math.PI / 2;
    
    // Calculate the average Y value for the mesh
    let avgY = 0;
    positions.forEach(pos => {
      avgY += pos.y;
    });
    avgY /= positions.length;
    
    // Position the mesh at the average Y value
    mesh.position.y = avgY + 0.01; // Slight offset to avoid z-fighting
    
    mesh.name = `area-fill-${measurement.id}`;
    
    scene.add(mesh);
    
    // Store reference to the mesh in the measurement
    if (!measurement.lineObjects) {
      measurement.lineObjects = [];
    }
    measurement.lineObjects.push(mesh as unknown as THREE.Line);
    
    // Create outline
    const outlineGeometry = new THREE.BufferGeometry();
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i < positions.length; i++) {
      points.push(positions[i].clone());
    }
    
    // Close the loop
    points.push(positions[0].clone());
    
    outlineGeometry.setFromPoints(points);
    
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x27ae60,
      linewidth: 2
    });
    
    const outline = new THREE.Line(outlineGeometry, outlineMaterial);
    outline.name = `area-outline-${measurement.id}`;
    scene.add(outline);
    
    measurement.lineObjects.push(outline);
    
    // Calculate final area value
    measurement.value = calculatePolygonArea(positions);
  } catch (error) {
    console.error('Error finalizing polygon:', error);
  }
};
