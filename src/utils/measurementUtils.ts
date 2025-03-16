
import * as THREE from 'three';
import { nanoid } from 'nanoid';

// Types
export type MeasurementType = 'none' | 'length' | 'height' | 'area';

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
  visible?: boolean;
  description?: string;
  isActive?: boolean;
  editMode?: boolean;
  inclination?: number;
  labelObject?: THREE.Sprite;
  lineObjects?: THREE.Line[];
  pointObjects?: THREE.Mesh[];
}

// Functions
export const createMeasurementId = (): string => {
  return nanoid(8);
};

export const calculateDistance = (point1: THREE.Vector3, point2: THREE.Vector3): number => {
  return point1.distanceTo(point2);
};

export const calculateHeight = (point1: THREE.Vector3, point2: THREE.Vector3): number => {
  return Math.abs(point2.y - point1.y);
};

export const calculateInclination = (point1: THREE.Vector3, point2: THREE.Vector3): number => {
  const horizontal = new THREE.Vector3(point2.x, point1.y, point2.z);
  const horizontalDistance = point1.distanceTo(horizontal);
  if (horizontalDistance === 0) return 90;
  
  const height = Math.abs(point2.y - point1.y);
  return Math.atan(height / horizontalDistance) * (180 / Math.PI);
};

export const isInclinationSignificant = (inclination: number): boolean => {
  return inclination > 5;
};

export const formatMeasurementWithInclination = (value: number, inclination?: number): string => {
  const formattedValue = value.toFixed(2);
  if (inclination !== undefined && isInclinationSignificant(inclination)) {
    return `${formattedValue} m | ${inclination.toFixed(1)}°`;
  }
  return `${formattedValue} m`;
};

export const calculatePolygonArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area / 2);
};

export const createTextSprite = (
  text: string, 
  position: THREE.Vector3,
  color: number = 0xffffff,
  size: number = 0.5
): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Could not get canvas context");
  
  canvas.width = 256;
  canvas.height = 128;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = '24px Arial';
  context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  
  sprite.position.copy(position);
  sprite.scale.set(size, size / 2, 1);
  
  return sprite;
};

export const updateLabelScale = (sprite: THREE.Sprite, camera: THREE.Camera): void => {
  if (!sprite.userData.baseScale) {
    sprite.userData.baseScale = { 
      x: sprite.scale.x, 
      y: sprite.scale.y, 
      z: sprite.scale.z 
    };
  }
  
  const distance = sprite.position.distanceTo(camera.position);
  const scale = Math.max(1, distance / 5);
  
  sprite.scale.set(
    sprite.userData.baseScale.x * scale,
    sprite.userData.baseScale.y * scale,
    sprite.userData.baseScale.z
  );
};

export const createDraggablePointMaterial = (hover: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({ 
    color: hover ? 0xff9900 : 0xff0000,
    opacity: hover ? 0.9 : 0.7,
    transparent: true
  });
};

export const createEditablePointMaterial = (selected: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({ 
    color: selected ? 0x00ff00 : 0x0000ff,
    opacity: selected ? 0.9 : 0.7,
    transparent: true
  });
};

export const createDraggablePoint = (
  position: THREE.Vector3, 
  name: string = 'point'
): THREE.Mesh => {
  const geometry = new THREE.SphereGeometry(0.05, 16, 16);
  const material = createDraggablePointMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.name = name;
  return mesh;
};

export const createMeasurementLine = (
  points: THREE.Vector3[],
  color: number = 0xffffff
): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geometry, material);
  return line;
};

export const isDoubleClick = (currentTime: number, lastClickTime: number): boolean => {
  return currentTime - lastClickTime < 300;
};

export const togglePointSelection = (point: THREE.Mesh): void => {
  if (!point.userData) point.userData = {};
  point.userData.selected = !point.userData.selected;
  
  if (point.material instanceof THREE.MeshBasicMaterial) {
    if (point.userData.selected) {
      point.material.color.set(0x00ff00);
      point.material.opacity = 0.9;
    } else {
      point.material.color.set(0xff0000);
      point.material.opacity = 0.7;
    }
  }
};

export const isPointSelected = (point: THREE.Mesh): boolean => {
  return point.userData?.selected || false;
};

export const highlightMeasurementPoints = (
  measurement: Measurement, 
  hover: boolean = false
): void => {
  if (!measurement.pointObjects) return;
  
  measurement.pointObjects.forEach(point => {
    if (point.material instanceof THREE.MeshBasicMaterial) {
      if (measurement.editMode) {
        point.material.color.set(hover ? 0x00ffff : 0x0000ff);
      } else {
        point.material.color.set(hover ? 0xff9900 : 0xff0000);
      }
      point.material.opacity = hover ? 0.9 : 0.7;
    }
  });
};

export const updateCursorForDraggablePoint = (
  isHovering: boolean,
  isDragging: boolean
): void => {
  if (isDragging) {
    document.body.style.cursor = 'grabbing';
  } else if (isHovering) {
    document.body.style.cursor = 'grab';
  } else {
    document.body.style.cursor = 'auto';
  }
};

export const findNearestEditablePoint = (
  measurements: Measurement[],
  raycaster: THREE.Raycaster,
  camera: THREE.Camera
): { measurement: Measurement, pointIndex: number, point: THREE.Mesh } | null => {
  const editableMeasurements = measurements.filter(m => m.editMode && m.visible !== false);
  if (editableMeasurements.length === 0) return null;
  
  for (const measurement of editableMeasurements) {
    if (!measurement.pointObjects) continue;
    
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(measurement.pointObjects, false);
    
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const pointIndex = measurement.pointObjects.findIndex(p => p === intersect.object);
      
      if (pointIndex !== -1) {
        return {
          measurement,
          pointIndex,
          point: measurement.pointObjects[pointIndex]
        };
      }
    }
  }
  
  return null;
};

export const updateMeasurementGeometry = (
  measurement: Measurement,
  updatedPointIndex: number
): void => {
  if (!measurement.points || !measurement.lineObjects) return;
  
  if (measurement.type === 'length') {
    if (measurement.lineObjects.length > 0 && measurement.points.length >= 2) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        measurement.points[0].position,
        measurement.points[1].position
      ]);
      
      measurement.lineObjects[0].geometry.dispose();
      measurement.lineObjects[0].geometry = lineGeometry;
    }
  } else if (measurement.type === 'height') {
    if (measurement.lineObjects.length > 0 && measurement.points.length >= 2) {
      const verticalPoint = new THREE.Vector3(
        measurement.points[0].position.x,
        measurement.points[1].position.y,
        measurement.points[0].position.z
      );
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        measurement.points[0].position,
        verticalPoint,
        measurement.points[1].position
      ]);
      
      measurement.lineObjects[0].geometry.dispose();
      measurement.lineObjects[0].geometry = lineGeometry;
    }
  } else if (measurement.type === 'area') {
    if (measurement.points.length >= 3) {
      // For each line segment
      for (let i = 0; i < measurement.points.length; i++) {
        const j = (i + 1) % measurement.points.length;
        
        if (i < measurement.lineObjects.length) {
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            measurement.points[i].position,
            measurement.points[j].position
          ]);
          
          measurement.lineObjects[i].geometry.dispose();
          measurement.lineObjects[i].geometry = lineGeometry;
        }
      }
    }
  }
  
  if (measurement.labelObject) {
    let labelPosition: THREE.Vector3;
    
    if (measurement.type === 'length') {
      labelPosition = new THREE.Vector3().addVectors(
        measurement.points[0].position,
        measurement.points[1].position
      ).multiplyScalar(0.5);
      labelPosition.y += 0.1;
    } else if (measurement.type === 'height') {
      const midHeight = (
        measurement.points[0].position.y + 
        measurement.points[1].position.y
      ) / 2;
      
      labelPosition = new THREE.Vector3(
        measurement.points[0].position.x,
        midHeight,
        measurement.points[0].position.z
      );
      labelPosition.x += 0.1;
    } else if (measurement.type === 'area') {
      // Find center of polygon
      const center = new THREE.Vector3();
      measurement.points.forEach(p => center.add(p.position));
      center.divideScalar(measurement.points.length);
      center.y += 0.1;
      
      labelPosition = center;
    } else {
      labelPosition = measurement.points[0].position.clone();
      labelPosition.y += 0.1;
    }
    
    measurement.labelObject.position.copy(labelPosition);
  }
};

export const updateAreaPreview = (
  points: MeasurementPoint[],
  measurementGroup: THREE.Group
): void => {
  if (points.length < 2) return;
  
  // Remove any existing preview
  clearPreviewObjects(measurementGroup);
  
  const positions = points.map(p => p.position);
  
  // Create preview lines
  for (let i = 0; i < positions.length - 1; i++) {
    const line = createMeasurementLine(
      [positions[i], positions[i + 1]],
      0xffff00
    );
    line.name = 'preview-line';
    measurementGroup.add(line);
  }
  
  // Add closing line if there are at least 3 points
  if (positions.length >= 3) {
    const closingLine = createMeasurementLine(
      [positions[positions.length - 1], positions[0]],
      0xffff00
    );
    closingLine.name = 'preview-line-closing';
    closingLine.visible = true;
    measurementGroup.add(closingLine);
    
    // Create area label
    const area = calculatePolygonArea(positions);
    
    // Find center of polygon
    const center = new THREE.Vector3();
    positions.forEach(p => center.add(p));
    center.divideScalar(positions.length);
    center.y += 0.1;
    
    const labelText = area < 0.01 
      ? `${(area * 10000).toFixed(2)} cm²` 
      : `${area.toFixed(2)} m²`;
    
    const label = createTextSprite(labelText, center, 0xffff00);
    label.name = 'preview-label';
    measurementGroup.add(label);
  }
};

export const closePolygon = (
  points: MeasurementPoint[],
  measurementGroup: THREE.Group
): void => {
  if (points.length < 3) return;

  // Clear any existing preview objects
  clearPreviewObjects(measurementGroup);
  
  const positions = points.map(p => p.position);
  
  // Create permanent area mesh
  const shape = new THREE.Shape();
  shape.moveTo(positions[0].x, positions[0].z);
  
  for (let i = 1; i < positions.length; i++) {
    shape.lineTo(positions[i].x, positions[i].z);
  }
  
  shape.lineTo(positions[0].x, positions[0].z);
};

export const finalizePolygon = (
  points: MeasurementPoint[],
  measurementGroup: THREE.Group
): Measurement => {
  if (points.length < 3) {
    throw new Error("Cannot finalize polygon with fewer than 3 points");
  }
  
  const positions = points.map(p => p.position);
  const area = calculatePolygonArea(positions);
  
  // Create point objects
  const pointObjects: THREE.Mesh[] = [];
  for (let i = 0; i < points.length; i++) {
    const pointName = `point-${createMeasurementId()}-${i}`;
    const pointMesh = createDraggablePoint(points[i].position, pointName);
    measurementGroup.add(pointMesh);
    pointObjects.push(pointMesh);
  }
  
  // Create line objects
  const lineObjects: THREE.Line[] = [];
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const line = createMeasurementLine([positions[i], positions[j]], 0xffff00);
    measurementGroup.add(line);
    lineObjects.push(line);
  }
  
  // Create center label
  const center = new THREE.Vector3();
  positions.forEach(p => center.add(p));
  center.divideScalar(positions.length);
  center.y += 0.1;
  
  const labelText = area < 0.01 
    ? `${(area * 10000).toFixed(2)} cm²` 
    : `${area.toFixed(2)} m²`;
  
  const label = createTextSprite(labelText, center, 0xffff00);
  measurementGroup.add(label);
  
  const measurement: Measurement = {
    id: createMeasurementId(),
    type: 'area',
    points,
    value: area,
    unit: 'm²',
    visible: true,
    isActive: false,
    labelObject: label,
    lineObjects,
    pointObjects
  };
  
  return measurement;
};

export const clearPreviewObjects = (measurementGroup: THREE.Group): void => {
  const previewObjects = measurementGroup.children.filter(
    child => child.name.startsWith('preview-')
  );
  
  previewObjects.forEach(obj => {
    if (obj instanceof THREE.Line) {
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      } else if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      }
    } else if (obj instanceof THREE.Sprite) {
      if (obj.material instanceof THREE.SpriteMaterial && obj.material.map) {
        obj.material.map.dispose();
      }
      obj.material.dispose();
    }
    
    measurementGroup.remove(obj);
  });
};
