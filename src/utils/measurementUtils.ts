import * as THREE from 'three';

export type MeasurementType = 'length' | 'height' | 'none';

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

// Create a text sprite for measurement labels
export const createTextSprite = (text: string, position: THREE.Vector3, color: number = 0xffffff): THREE.Sprite => {
  // Create canvas for texture
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not get canvas context");
  
  // Increase canvas size for better resolution
  canvas.width = 512; 
  canvas.height = 128;
  
  // Set a solid background with rounded corners
  context.fillStyle = 'rgba(0, 0, 0, 0.9)';
  context.roundRect(0, 0, canvas.width, canvas.height, 16);
  context.fill();
  
  // Add border for better visibility
  context.strokeStyle = 'white';
  context.lineWidth = 4;
  context.roundRect(2, 2, canvas.width-4, canvas.height-4, 14);
  context.stroke();
  
  // Use the Inter font which is used in the UI (from index.css)
  context.font = 'bold 48px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // Add text shadow for better contrast
  context.shadowColor = 'black';
  context.shadowBlur = 4;
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 2;
  
  // Draw text
  context.fillStyle = 'white';
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

// Highlight measurement points for edit mode - VERBESSERTE VERSION
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
      
      // Speichere originale Skalierung, falls noch nicht vorhanden
      if (!point.userData.originalScale) {
        point.userData.originalScale = point.scale.clone();
      }
      
      // Apply appropriate material and update editable state
      if (highlight) {
        // Setze Editiermodus-Flag
        point.userData.isEditable = true;
        
        // Wechsle Material zur auffälligen Editiermodusfarbe
        point.material.dispose();
        point.material = createEditablePointMaterial(false);
        
        // Vergrößere den Punkt deutlich für bessere Sichtbarkeit und Interaktion
        const scaleUp = 1.75; // 175% der Originalgröße
        point.scale.set(
          point.userData.originalScale.x * scaleUp,
          point.userData.originalScale.y * scaleUp,
          point.userData.originalScale.z * scaleUp
        );
        
        // Setze benutzerdefinierten Cursor-Stil
        document.body.style.cursor = 'grab';
      } else {
        // Deaktiviere Editiermodus
        point.userData.isEditable = false;
        
        // Setze normalen Cursor zurück
        document.body.style.cursor = 'auto';
        
        // Setze Originalgröße zurück
        point.scale.copy(point.userData.originalScale);
        
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
