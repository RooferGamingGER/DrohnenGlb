
import * as THREE from 'three';
import { nanoid } from 'nanoid';

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
  editMode?: boolean;
  inclination?: number;
  labelObject?: THREE.Sprite;
  lineObjects?: THREE.Line[];
  pointObjects?: THREE.Mesh[];
  isActive?: boolean;
}

export const createMeasurementId = () => nanoid(8);

export const calculateDistance = (point1: THREE.Vector3, point2: THREE.Vector3): number => {
  return point1.distanceTo(point2);
};

export const calculateHeight = (point1: THREE.Vector3, point2: THREE.Vector3): number => {
  return Math.abs(point2.y - point1.y);
};

export const calculateInclination = (point1: THREE.Vector3, point2: THREE.Vector3): number => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  
  const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
  
  if (horizontalDistance < 0.0001) return 90;
  
  const angleRad = Math.atan2(Math.abs(dy), horizontalDistance);
  return angleRad * (180 / Math.PI);
};

export const isInclinationSignificant = (inclination: number): boolean => {
  return inclination >= 5;
};

export const formatMeasurementWithInclination = (value: number, inclination?: number): string => {
  if (inclination !== undefined && isInclinationSignificant(inclination)) {
    return `${value.toFixed(2)} m / ${inclination.toFixed(1)}°`;
  }
  return `${value.toFixed(2)} m`;
};

export const createTextCanvas = (text: string, backgroundColor: number = 0xffffff, textColor: string = 'black'): HTMLCanvasElement => {
  const bgColorHex = '#' + backgroundColor.toString(16).padStart(6, '0');
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get 2D context for label canvas');
  
  const fontSize = 60;
  const padding = 10;
  
  context.font = `${fontSize}px Arial, sans-serif`;
  
  const textMetrics = context.measureText(text);
  const textWidth = textMetrics.width;
  const textHeight = fontSize;
  
  canvas.width = textWidth + padding * 2;
  canvas.height = textHeight + padding * 2;
  
  context.fillStyle = bgColorHex;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.fillStyle = textColor;
  context.font = `${fontSize}px Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  return canvas;
};

export const createTextSprite = (text: string, position: THREE.Vector3, backgroundColor: number): THREE.Sprite => {
  const canvas = createTextCanvas(text, backgroundColor);
  const texture = new THREE.CanvasTexture(canvas);
  
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    sizeAttenuation: false
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  
  const canvasAspect = canvas.width / canvas.height;
  sprite.scale.set(0.8 * canvasAspect, 0.4, 1);
  
  return sprite;
};

export const updateLabelScale = (sprite: THREE.Sprite, camera: THREE.Camera): void => {
  if (!sprite.userData || !sprite.userData.baseScale) {
    sprite.userData = {
      ...sprite.userData,
      baseScale: { x: sprite.scale.x, y: sprite.scale.y, z: sprite.scale.z }
    };
  }
  
  const distance = sprite.position.distanceTo(camera.position);
  const scale = distance / 8;
  
  sprite.scale.set(
    sprite.userData.baseScale.x * scale,
    sprite.userData.baseScale.y * scale,
    1
  );
};

export const createDraggablePointMaterial = (isHovered: boolean): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({
    color: isHovered ? 0xff8800 : 0xffaa00,
    transparent: true,
    opacity: 0.8,
    depthTest: true
  });
};

export const createEditablePointMaterial = (isSelected: boolean): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({
    color: isSelected ? 0xff3333 : 0xff0000,
    transparent: true,
    opacity: 0.8,
    depthTest: true
  });
};

export const createDraggablePoint = (position: THREE.Vector3, name?: string): THREE.Mesh => {
  const geometry = new THREE.SphereGeometry(0.025, 16, 16);
  const material = createDraggablePointMaterial(false);
  
  const point = new THREE.Mesh(geometry, material);
  point.position.copy(position);
  
  if (name) {
    point.name = name;
  }
  
  point.userData = {
    ...point.userData,
    isDraggable: true,
    isSelected: false
  };
  
  return point;
};

export const createMeasurementLine = (points: THREE.Vector3[], color: number): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  
  const material = new THREE.LineBasicMaterial({
    color: color,
    linewidth: 2,
    depthTest: true
  });
  
  return new THREE.Line(geometry, material);
};

export const isDoubleClick = (currentTime: number, lastClickTime: number): boolean => {
  return currentTime - lastClickTime < 300;
};

export const togglePointSelection = (point: THREE.Mesh): void => {
  if (!point.userData) {
    point.userData = {};
  }
  
  point.userData.isSelected = !point.userData.isSelected;
  
  point.material = point.userData.isSelected
    ? createEditablePointMaterial(true)
    : createDraggablePointMaterial(false);
};

export const isPointSelected = (point: THREE.Mesh): boolean => {
  return point.userData && point.userData.isSelected;
};

export const calculatePolygonArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  let area = 0;
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    
    // Using the shoelace formula modified for 3D points projected onto the XZ plane
    area += points[i].x * points[j].z - points[j].x * points[i].z;
  }
  
  return Math.abs(area) / 2;
};

export const highlightMeasurementPoints = (
  measurement: Measurement, 
  measurementGroup: THREE.Group,
  highlight: boolean = true
): void => {
  if (!measurement.pointObjects) return;
  
  measurement.pointObjects.forEach(point => {
    if (point) {
      point.material = highlight 
        ? createEditablePointMaterial(false) 
        : createDraggablePointMaterial(false);
      
      if (point.userData) {
        point.userData.isDraggable = true;
      }
    }
  });
};

export const closePolygon = (points: MeasurementPoint[]): MeasurementPoint[] => {
  if (!points || points.length < 3) return points;
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  const distance = lastPoint.position.distanceTo(firstPoint.position);
  
  if (distance < 0.1) {
    return points;
  }
  
  return [...points];
};

export const findNearestEditablePoint = (
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  mousePosition: THREE.Vector2,
  measurementGroup: THREE.Group
): { measurement: Measurement, pointIndex: number, point: THREE.Mesh } | null => {
  const pointObjects = measurementGroup.children.filter(
    child => child instanceof THREE.Mesh && child.name.startsWith('point-')
  );
  
  const intersects = raycaster.intersectObjects(pointObjects, false);
  
  if (intersects.length > 0) {
    const pointMesh = intersects[0].object as THREE.Mesh;
    const pointId = pointMesh.name;
    
    const nameParts = pointId.split('-');
    if (nameParts.length >= 3) {
      const measurementId = nameParts[1];
      const pointIndex = parseInt(nameParts[2], 10);
      
      // Find the measurement that this point belongs to
      const measurements = measurementGroup.parent?.userData?.measurements as Measurement[] || [];
      const measurement = measurements.find(m => m.id === measurementId);
      
      if (measurement && (measurement.editMode || pointMesh.userData?.isSelected)) {
        return { measurement, pointIndex, point: pointMesh };
      }
    }
  }
  
  return null;
};

export const updateCursorForDraggablePoint = (isHovering: boolean): void => {
  document.body.style.cursor = isHovering ? 'pointer' : 'auto';
};

export const updateMeasurementGeometry = (measurement: Measurement): void => {
  if (!measurement.pointObjects || !measurement.lineObjects) return;
  
  // Update points positions if needed
  
  // Update line geometry
  if (measurement.type === 'length' && measurement.lineObjects.length > 0) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      measurement.points[0].position,
      measurement.points[1].position
    ]);
    
    measurement.lineObjects[0].geometry.dispose();
    measurement.lineObjects[0].geometry = lineGeometry;
  } else if (measurement.type === 'height' && measurement.lineObjects.length > 0) {
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
  } else if (measurement.type === 'area' && measurement.lineObjects.length > 0) {
    // For area, we need to update the polygon
    const positions = measurement.points.map(p => p.position);
    if (positions.length >= 3) {
      // Close the polygon by adding the first point at the end
      const closedPositions = [...positions];
      if (positions[0].distanceTo(positions[positions.length - 1]) > 0.001) {
        closedPositions.push(positions[0]);
      }
      
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(closedPositions);
      measurement.lineObjects[0].geometry.dispose();
      measurement.lineObjects[0].geometry = lineGeometry;
    }
  }
  
  // Update label position
  if (measurement.labelObject) {
    let labelPosition: THREE.Vector3;
    
    if (measurement.type === 'length' && measurement.points.length >= 2) {
      labelPosition = new THREE.Vector3().addVectors(
        measurement.points[0].position,
        measurement.points[1].position
      ).multiplyScalar(0.5);
      labelPosition.y += 0.1;
    } else if (measurement.type === 'height' && measurement.points.length >= 2) {
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
    } else if (measurement.type === 'area' && measurement.points.length >= 3) {
      // Calculate centroid of the polygon for area measurement
      let centroidX = 0, centroidY = 0, centroidZ = 0;
      measurement.points.forEach(point => {
        centroidX += point.position.x;
        centroidY += point.position.y;
        centroidZ += point.position.z;
      });
      
      const numPoints = measurement.points.length;
      labelPosition = new THREE.Vector3(
        centroidX / numPoints,
        centroidY / numPoints + 0.1,
        centroidZ / numPoints
      );
    } else {
      return;
    }
    
    measurement.labelObject.position.copy(labelPosition);
  }
};

export const finalizePolygon = (measurement: Measurement, measurementGroup: THREE.Group): void => {
  if (measurement.type !== 'area' || !measurement.points || measurement.points.length < 3) return;
  
  const positions = measurement.points.map(p => p.position);
  
  // Create face geometry for the area
  const shape = new THREE.Shape();
  shape.moveTo(positions[0].x, positions[0].z);
  
  for (let i = 1; i < positions.length; i++) {
    shape.lineTo(positions[i].x, positions[i].z);
  }
  
  shape.lineTo(positions[0].x, positions[0].z);
  
  const geometry = new THREE.ShapeGeometry(shape);
  
  // Rotate the geometry to lay flat on the XZ plane
  geometry.rotateX(Math.PI / 2);
  
  // Adjust Y position
  let avgY = 0;
  positions.forEach(pos => { avgY += pos.y; });
  avgY /= positions.length;
  
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = avgY + 0.01; // Slightly above the points to avoid z-fighting
  mesh.name = `area-${measurement.id}`;
  
  // Store the mesh in the measurement
  measurement.lineObjects = [...(measurement.lineObjects || []), mesh];
  
  measurementGroup.add(mesh);
};

export const updateAreaPreview = (
  measurement: Measurement,
  points: MeasurementPoint[],
  measurementGroup: THREE.Group,
  camera: THREE.Camera
): void => {
  // Remove any existing preview
  clearPreviewObjects(measurement, measurementGroup);
  
  if (points.length < 3) return;
  
  const positions = points.map(p => p.position);
  
  // Create line connecting all points
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([...positions, positions[0]]);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6
  });
  
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.name = `preview-line-${measurement.id}`;
  
  // Create area mesh
  const shape = new THREE.Shape();
  shape.moveTo(positions[0].x, positions[0].z);
  
  for (let i = 1; i < positions.length; i++) {
    shape.lineTo(positions[i].x, positions[i].z);
  }
  
  shape.lineTo(positions[0].x, positions[0].z);
  
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  
  let avgY = 0;
  positions.forEach(pos => { avgY += pos.y; });
  avgY /= positions.length;
  
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = avgY + 0.01;
  mesh.name = `preview-mesh-${measurement.id}`;
  
  // Add area text
  const areaValue = calculatePolygonArea(positions);
  
  const labelText = areaValue < 0.01 ? 
    `${(areaValue * 10000).toFixed(2)} cm²` : 
    `${areaValue.toFixed(2)} m²`;
  
  // Calculate centroid for label position
  let centroidX = 0, centroidY = 0, centroidZ = 0;
  positions.forEach(pos => {
    centroidX += pos.x;
    centroidY += pos.y;
    centroidZ += pos.z;
  });
  
  const centroid = new THREE.Vector3(
    centroidX / positions.length,
    centroidY / positions.length + 0.1,
    centroidZ / positions.length
  );
  
  const label = createTextSprite(labelText, centroid, 0x00ff00);
  label.name = `preview-label-${measurement.id}`;
  
  label.userData = {
    ...label.userData,
    isLabel: true,
    baseScale: { x: 0.8, y: 0.4, z: 1 }
  };
  
  updateLabelScale(label, camera);
  
  // Add all preview objects to the measurement group
  measurementGroup.add(line);
  measurementGroup.add(mesh);
  measurementGroup.add(label);
};

export const clearPreviewObjects = (measurement: Measurement, measurementGroup: THREE.Group): void => {
  const previewObjectNames = [
    `preview-line-${measurement.id}`,
    `preview-mesh-${measurement.id}`,
    `preview-label-${measurement.id}`
  ];
  
  previewObjectNames.forEach(name => {
    const object = measurementGroup.children.find(child => child.name === name);
    if (object) {
      if (object instanceof THREE.Line || object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
      
      if (object.material instanceof THREE.Material) {
        object.material.dispose();
      } else if (Array.isArray(object.material)) {
        object.material.forEach(mat => mat.dispose());
      }
      
      measurementGroup.remove(object);
    }
  });
};
