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
  polygonObject?: THREE.Mesh; // Reference to the 3D polygon for area measurements
  area?: number; // Flächeninhalt in Quadratmetern
  isComplete?: boolean; // Flag to indicate if the area measurement is complete
}

// Function to check if inclination is significant (i.e., worth displaying)
export const isInclinationSignificant = (inclination: number): boolean => {
  return inclination > 2.0; // More than 2 degrees is considered significant
};

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

// Calculate area of a polygon using the Shoelace formula (Gauss's Area formula)
export const calculateArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  
  // Project points onto the best-fitting plane
  // First, calculate the normal of the best-fitting plane
  const centroid = new THREE.Vector3();
  for (const point of points) {
    centroid.add(point);
  }
  centroid.divideScalar(points.length);
  
  // Use SVD (simplified as we're just finding a normal direction)
  // Create a covariance matrix
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  
  for (const point of points) {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const dz = point.z - centroid.z;
    
    xx += dx * dx;
    xy += dx * dy;
    xz += dx * dz;
    yy += dy * dy;
    yz += dy * dz;
    zz += dz * dz;
  }
  
  // Find minimal eigenvector (simplified approach - this is approximated)
  // For a proper solution we would use SVD or eigenvalue decomposition
  // This is a simplified approach that works for most roofs
  const normal = new THREE.Vector3(xy, xz, yz);
  normal.normalize();
  
  // Create a local coordinate system on the plane
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(normal.dot(u)) > 0.9) {
    u.set(0, 1, 0);
  }
  
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  u.crossVectors(v, normal).normalize();
  
  // Project all points onto the plane and calculate 2D coordinates
  const points2D: { x: number, y: number }[] = [];
  
  for (const point of points) {
    const localPoint = point.clone().sub(centroid);
    const x = localPoint.dot(u);
    const y = localPoint.dot(v);
    points2D.push({ x, y });
  }
  
  // Calculate area using the Shoelace formula
  for (let i = 0; i < points2D.length; i++) {
    const j = (i + 1) % points2D.length;
    area += points2D[i].x * points2D[j].y;
    area -= points2D[j].x * points2D[i].y;
  }
  
  return Math.abs(area) / 2;
};

// Function to check if a point is close to another point
export const isPointCloseToFirst = (
  firstPoint: THREE.Vector3, 
  currentPoint: THREE.Vector3, 
  threshold: number = 0.3
): boolean => {
  return firstPoint.distanceTo(currentPoint) < threshold;
};

// Format area measurement
export const formatArea = (area: number): string => {
  return `${area.toFixed(2)} m²`;
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

// Create a semi-transparent polygon for area visualization
export const createAreaPolygon = (
  points: THREE.Vector3[], 
  color: number = 0x00ff00, 
  opacity: number = 0.4
): THREE.Mesh => {
  if (points.length < 3) {
    console.error('Cannot create polygon with less than 3 points');
    // Return empty mesh
    return new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ visible: false })
    );
  }
  
  // Create a shape from the points
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].z); // Use x,z for horizontal roofs
  
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].z);
  }
  
  shape.closePath();
  
  // Create geometry
  const geometry = new THREE.ShapeGeometry(shape);
  
  // Adjust the Y coordinates of all vertices to follow the roof shape
  const positions = geometry.attributes.position;
  
  // Type guard for buffer access
  if (positions instanceof THREE.BufferAttribute || positions instanceof THREE.InterleavedBufferAttribute) {
    // Create a new array with the modified Y values
    const newPositions = new Float32Array(positions.array.length);
    
    // Copy the existing values
    for (let i = 0; i < positions.array.length; i++) {
      newPositions[i] = positions.array[i];
    }
    
    // Modify the Y values in the new array
    for (let i = 0; i < positions.count; i++) {
      const index = i * 3;
      const x = newPositions[index];
      const z = newPositions[index + 2];
      
      // Find the average Y of the closest points
      let totalY = 0;
      let totalWeight = 0;
      
      for (const point of points) {
        const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(z - point.z, 2));
        const weight = 1 / (distance + 0.001); // Avoid division by zero
        totalY += point.y * weight;
        totalWeight += weight;
      }
      
      // Apply the weighted average Y to the new array
      newPositions[index + 1] = totalY / totalWeight;
    }
    
    // Set the modified array back to the buffer with type checking
    if (positions instanceof THREE.BufferAttribute) {
      positions.copyArray(newPositions);
      positions.needsUpdate = true;
    } else if (positions instanceof THREE.InterleavedBufferAttribute) {
      // For InterleavedBufferAttribute, we need to handle it differently
      // by directly updating the underlying array
      for (let i = 0; i < positions.count; i++) {
        const index = i * 3;
        positions.setY(i, newPositions[index + 1]);
      }
      positions.needsUpdate = true;
    }
  }
  
  // Update geometry
  geometry.computeVertexNormals();
  
  // Create material
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  
  // Slightly move the polygon up to avoid z-fighting
  mesh.position.y += 0.005;
  
  return mesh;
};

// Update the measurement lines, polygon and label for area measurements
export const updateAreaMeasurementGeometry = (measurement: Measurement, scene: THREE.Group): void => {
  if (!measurement.points || measurement.points.length < 3) return;
  
  // Get the positions of all points
  const positions = measurement.points.map(p => p.position.clone());
  
  // Update or create lines
  if (!measurement.lineObjects) {
    measurement.lineObjects = [];
  }
  
  // Make sure we have enough lines
  while (measurement.lineObjects.length < positions.length) {
    const line = createMeasurementLine([new THREE.Vector3(), new THREE.Vector3()], 0x00ff00);
    measurement.lineObjects.push(line);
    scene.add(line);
  }
  
  // Remove excess lines
  while (measurement.lineObjects.length > positions.length) {
    const line = measurement.lineObjects.pop();
    if (line) {
      scene.remove(line);
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
    }
  }
  
  // Update line positions
  for (let i = 0; i < positions.length; i++) {
    const nextIndex = (i + 1) % positions.length;
    const linePoints = [positions[i], positions[nextIndex]];
    updateMeasurementLine(measurement.lineObjects[i], linePoints);
  }
  
  // Calculate area
  const area = calculateArea(positions);
  measurement.area = area;
  measurement.value = area; // Update value for consistency
  
  // Update or create polygon
  if (measurement.polygonObject) {
    // Remove old polygon
    scene.remove(measurement.polygonObject);
    measurement.polygonObject.geometry.dispose();
    if (measurement.polygonObject.material instanceof THREE.Material) {
      measurement.polygonObject.material.dispose();
    }
  }
  
  // Create new polygon
  measurement.polygonObject = createAreaPolygon(positions, 0x00ff00, 0.4);
  scene.add(measurement.polygonObject);
  
  // Update the label text with the new area
  const labelText = formatArea(area);
  
  // Calculate the center of the polygon for label placement
  const center = new THREE.Vector3();
  for (const pos of positions) {
    center.add(pos);
  }
  center.divideScalar(positions.length);
  
  // Add a small offset above the center for better visibility
  center.y += 0.2;
  
  // Update or create the label
  if (measurement.labelObject) {
    if (measurement.labelObject.parent) {
      const parent = measurement.labelObject.parent;
      
      // Create updated sprite
      const updatedSprite = createTextSprite(labelText, center, 0x00ff00);
      
      // Preserve the userData and scale from the existing label
      updatedSprite.userData = measurement.labelObject.userData;
      updatedSprite.scale.copy(measurement.labelObject.scale);
      
      // Replace the old label with the new one
      if (measurement.labelObject.material.map) {
        measurement.labelObject.material.map.dispose();
      }
      measurement.labelObject.material.dispose();
      parent.remove(measurement.labelObject);
      parent.add(updatedSprite);
      measurement.labelObject = updatedSprite;
    }
  } else {
    measurement.labelObject = createTextSprite(labelText, center, 0x00ff00);
    scene.add(measurement.labelObject);
  }
};

// Check if the area measurement should be completed (last point close to first point)
export const shouldCompleteAreaMeasurement = (
  measurement: Measurement, 
  threshold: number = 0.3
): boolean => {
  if (measurement.type !== 'area' || measurement.points.length < 3) {
    return false;
  }
  
  const firstPoint = measurement.points[0].position;
  const lastPoint = measurement.points[measurement.points.length - 1].position;
  
  // Überprüfe die Distanz zwischen erstem und letztem Punkt
  const distance = firstPoint.distanceTo(lastPoint);
  return distance < threshold;
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
  }
  
  // Update label position if it exists (use the existing label position update code)
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
    // For multi-point measurements, place near the last point
    else if (measurement.points.length > 2) {
      const lastPoint = measurement.points[measurement.points.length - 1].position;
      const offsetPosition = lastPoint.clone().add(new THREE.Vector3(0, 0.1, 0));
      measurement.labelObject.position.copy(offsetPosition);
    }
  }
};
