import * as THREE from 'three';

export type MeasurementType = 'length' | 'height' | 'roof' | 'none';

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
  areaObject?: THREE.Mesh; // Reference to the 3D area (for roof measurements)
  area?: number; // Flächeninhalt in Quadratmetern
  closedShape?: boolean; // Gibt an, ob die Form geschlossen ist
}

export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

export const calculateHeight = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return Math.abs(p2.y - p1.y);
};

export const calculateInclination = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  const horizontalDistance = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z).length();
  const heightDifference = Math.abs(p2.y - p1.y);
  const angleInRadians = Math.atan2(heightDifference, horizontalDistance);
  const angleInDegrees = THREE.MathUtils.radToDeg(angleInRadians);
  return parseFloat(angleInDegrees.toFixed(1));
};

export const isInclinationSignificant = (inclination: number, threshold: number = 5.0): boolean => {
  return inclination >= threshold;
};

export const formatMeasurement = (value: number, type: MeasurementType): string => {
  return `${value.toFixed(2)} m`;
};

export const formatMeasurementWithInclination = (
  value: number, 
  inclination: number | undefined
): string => {
  if (inclination !== undefined && isInclinationSignificant(inclination)) {
    return `${value.toFixed(2)} m | ${inclination.toFixed(1)}°`;
  }
  return `${value.toFixed(2)} m`;
};

export const formatArea = (area: number): string => {
  return `${area.toFixed(2)} m²`;
};

export const createMeasurementId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

export const createTextSprite = (text: string, position: THREE.Vector3, color: number = 0xffffff): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not get canvas context");
  
  canvas.width = 512; 
  canvas.height = 128;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.9)';
  context.roundRect(0, 0, canvas.width, canvas.height, 16);
  context.fill();
  
  context.strokeStyle = 'white';
  context.lineWidth = 4;
  context.roundRect(2, 2, canvas.width-4, canvas.height-4, 14);
  context.stroke();
  
  context.font = 'bold 48px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  context.shadowColor = 'black';
  context.shadowBlur = 4;
  context.shadowOffsetX = 2;
  context.shadowOffsetY = 2;
  
  context.fillStyle = 'white';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  
  const material = new THREE.SpriteMaterial({ 
    map: texture,
    sizeAttenuation: true,
    depthTest: false,
    depthWrite: false,
    transparent: true
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  sprite.scale.set(0.8, 0.4, 1);
  
  sprite.userData = {
    baseScale: { x: 0.8, y: 0.4, z: 1 },
    isLabel: true
  };
  
  return sprite;
};

export const updateLabelScale = (sprite: THREE.Sprite, camera: THREE.Camera): void => {
  if (!sprite.userData.baseScale) return;
  
  const distance = camera.position.distanceTo(sprite.position);
  
  const scaleFactor = Math.max(0.8, distance * 0.15);
  
  sprite.scale.set(
    sprite.userData.baseScale.x * scaleFactor,
    sprite.userData.baseScale.y * scaleFactor,
    1
  );
};

export const createEditablePointMaterial = (isSelected: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({ 
    color: isSelected ? 0x00ff00 : 0xff00ff,
    opacity: 0.9,
    transparent: true
  });
};

export const createDraggablePointMaterial = (isHovered: boolean = false, isSelected: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({ 
    color: isSelected ? 0x00ff00 : (isHovered ? 0xffff00 : 0xff0000),
    opacity: isHovered ? 0.8 : 1.0,
    transparent: true
  });
};

export const createDraggablePoint = (position: THREE.Vector3, name: string): THREE.Mesh => {
  const pointGeometry = new THREE.SphereGeometry(0.15, 16, 16);
  const pointMaterial = createDraggablePointMaterial();
  const point = new THREE.Mesh(pointGeometry, pointMaterial);
  point.position.copy(position);
  point.name = name;
  
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

export const updateMeasurementLine = (line: THREE.Line, points: THREE.Vector3[]): void => {
  if (line && line.geometry) {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
};

export const isDoubleClick = (currentTime: number, lastClickTime: number): boolean => {
  const doubleClickThreshold = 500;
  return (currentTime - lastClickTime) < doubleClickThreshold;
};

export const togglePointSelection = (point: THREE.Mesh): boolean => {
  if (!point.userData) point.userData = {};
  
  point.userData.isSelected = !point.userData.isSelected;
  
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

export const isPointSelected = (point: THREE.Mesh): boolean => {
  return point.userData?.isSelected === true;
};

export const highlightMeasurementPoints = (
  measurement: Measurement, 
  scene: THREE.Group, 
  highlight: boolean
): void => {
  if (!measurement.pointObjects) return;
  
  measurement.pointObjects.forEach((point) => {
    if (point instanceof THREE.Mesh && point.material instanceof THREE.MeshBasicMaterial) {
      if (highlight && !point.userData.originalMaterial) {
        point.userData.originalMaterial = point.material.clone();
      }
      
      if (highlight) {
        point.userData.isEditable = true;
        point.material.dispose();
        point.material = createEditablePointMaterial(false);
        document.body.style.cursor = 'grab';
      } else {
        point.userData.isEditable = false;
        document.body.style.cursor = 'auto';
        if (point.userData.originalMaterial) {
          point.material.dispose();
          point.material = point.userData.originalMaterial;
          point.userData.originalMaterial = null;
        }
      }
    }
  });
};

export const getPointHitTestRadius = (): number => {
  return 0.3;
};

export const updateCursorForDraggablePoint = (isOverDraggablePoint: boolean, isDragging: boolean = false): void => {
  if (isOverDraggablePoint) {
    document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
  } else {
    document.body.style.cursor = 'auto';
  }
};

export const findNearestEditablePoint = (
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  mousePosition: THREE.Vector2,
  scene: THREE.Group,
  hitRadius: number = 0.4
): THREE.Mesh | null => {
  raycaster.setFromCamera(mousePosition, camera);
  
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  for (const intersect of intersects) {
    const object = intersect.object;
    if (object instanceof THREE.Mesh && 
        object.userData && 
        object.userData.isDraggable && 
        object.userData.isEditable) {
      return object;
    }
  }
  
  const possiblePoints: {point: THREE.Mesh, distance: number}[] = [];
  
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && 
        object.userData && 
        object.userData.isDraggable && 
        object.userData.isEditable) {
      const pointPosition = new THREE.Vector3();
      object.getWorldPosition(pointPosition);
      
      const screenPosition = pointPosition.clone().project(camera);
      
      const distance = Math.sqrt(
        Math.pow(screenPosition.x - mousePosition.x, 2) + 
        Math.pow(screenPosition.y - mousePosition.y, 2)
      );
      
      if (distance < hitRadius) {
        possiblePoints.push({point: object, distance});
      }
    }
  });
  
  if (possiblePoints.length > 0) {
    possiblePoints.sort((a, b) => a.distance - b.distance);
    return possiblePoints[0].point;
  }
  
  return null;
};

export const calculateArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area) / 2;
};

export const calculateNormal = (points: THREE.Vector3[]): THREE.Vector3 => {
  if (points.length < 3) return new THREE.Vector3(0, 1, 0);
  
  const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
  const v2 = new THREE.Vector3().subVectors(points[2], points[0]);
  
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  
  return normal;
};

export const createRoofShape = (points: THREE.Vector3[], color: number = 0x2196f3): THREE.Mesh => {
  if (points.length < 3) return null;
  
  const shape = new THREE.Shape();
  
  shape.moveTo(points[0].x, points[0].z);
  
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].z);
  }
  
  shape.closePath();
  
  const geometry = new THREE.ShapeGeometry(shape);
  
  const normal = calculateNormal(points);
  
  let avgY = 0;
  for (const point of points) {
    avgY += point.y;
  }
  avgY /= points.length;
  
  const matrix = new THREE.Matrix4();
  
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  
  mesh.position.y = avgY;
  
  if (Math.abs(normal.y) < 0.99) {
    const rotationAxis = new THREE.Vector3(normal.z, 0, -normal.x).normalize();
    const angle = Math.acos(normal.y);
    mesh.rotateOnAxis(rotationAxis, angle);
  }
  
  return mesh;
};

export const createDashedLine = (points: THREE.Vector3[], color: number = 0xffffff): THREE.Line => {
  const lineMaterial = new THREE.LineDashedMaterial({
    color: color,
    linewidth: 2,
    scale: 1,
    dashSize: 0.2,
    gapSize: 0.1,
  });
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(lineGeometry, lineMaterial);
  
  line.computeLineDistances();
  
  return line;
};

export const isPointNearPoint = (point1: THREE.Vector3, point2: THREE.Vector3, threshold: number = 0.5): boolean => {
  return point1.distanceTo(point2) < threshold;
};

export const updateRoofMeasurementGeometry = (measurement: Measurement): void => {
  if (!measurement.points || measurement.points.length < 3) return;
  
  const points3D = measurement.points.map(p => p.position.clone());
  
  if (measurement.lineObjects && measurement.lineObjects.length > 0) {
    for (let i = 0; i < measurement.points.length; i++) {
      const startIndex = i;
      const endIndex = (i + 1) % measurement.points.length;
      
      const linePoints = [
        measurement.points[startIndex].position.clone(),
        measurement.points[endIndex].position.clone()
      ];
      
      if (i < measurement.lineObjects.length) {
        updateMeasurementLine(measurement.lineObjects[i], linePoints);
      }
    }
  }
  
  const area = calculateArea(points3D);
  measurement.area = area;
  measurement.value = area;
  
  if (measurement.areaObject && measurement.areaObject.parent) {
    const parent = measurement.areaObject.parent;
    
    measurement.areaObject.geometry.dispose();
    if (measurement.areaObject.material instanceof THREE.Material) {
      measurement.areaObject.material.dispose();
    } else if (Array.isArray(measurement.areaObject.material)) {
      measurement.areaObject.material.forEach(m => m.dispose());
    }
    parent.remove(measurement.areaObject);
    
    if (measurement.points.length >= 3) {
      const newAreaObject = createRoofShape(points3D);
      if (newAreaObject) {
        parent.add(newAreaObject);
        measurement.areaObject = newAreaObject;
      }
    }
  }
  
  if (measurement.labelObject && measurement.labelObject.material instanceof THREE.SpriteMaterial) {
    const labelText = `${formatArea(area)}`;
    
    const centroid = new THREE.Vector3();
    for (const point of points3D) {
      centroid.add(point);
    }
    centroid.divideScalar(points3D.length);
    
    const normal = calculateNormal(points3D);
    centroid.add(normal.multiplyScalar(0.1));
    
    const updatedSprite = createTextSprite(
      labelText,
      centroid,
      0x2196f3
    );
    
    updatedSprite.userData = measurement.labelObject.userData;
    updatedSprite.scale.copy(measurement.labelObject.scale);
    
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
};
