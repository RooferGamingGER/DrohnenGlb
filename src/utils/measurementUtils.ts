
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
  description?: string;
  isActive?: boolean;
  labelObject?: THREE.Sprite; // Reference to the 3D label
  lineObjects?: THREE.Line[]; // References to the 3D lines
  pointObjects?: THREE.Mesh[]; // References to the 3D points
  areaObject?: THREE.Mesh; // Reference to the 3D area mesh
}

// Calculate distance between two points in 3D space
export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

// Calculate height difference (y-axis) between two points
export const calculateHeight = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return Math.abs(p2.y - p1.y);
};

// Calculate the area of a polygon defined by an array of points
export const calculateArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;

  // Compute the area using the shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    // Project onto the XZ plane for roofing applications
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area) / 2;
};

// Format measurement value with appropriate unit
export const formatMeasurement = (value: number, type: MeasurementType): string => {
  if (type === 'area') {
    return `${value.toFixed(2)} m²`;
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

// Create draggable point material
export const createDraggablePointMaterial = (isHovered: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({ 
    color: isHovered ? 0xffff00 : 0xff0000,
    opacity: isHovered ? 0.8 : 1.0,
    transparent: true
  });
};

// Create a semi-transparent area mesh for area measurements
export const createAreaMesh = (points: THREE.Vector3[]): THREE.Mesh | null => {
  if (points.length < 3) return null;

  // Create a shape for the area
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].z); // Project to XZ plane for roofs
  
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].z);
  }
  
  shape.lineTo(points[0].x, points[0].z); // Close the shape
  
  // Create geometry from shape
  const geometry = new THREE.ShapeGeometry(shape);
  
  // Rotate to XZ plane (for roofing applications)
  geometry.rotateX(-Math.PI / 2);
  
  // Calculate average Y position for all points
  let avgY = 0;
  for (const point of points) {
    avgY += point.y;
  }
  avgY /= points.length;
  
  // Offset the geometry to sit slightly above the measured points
  const offset = 0.02; // Small offset to prevent z-fighting
  
  // Get position attribute
  const positionAttribute = geometry.getAttribute('position');
  const count = positionAttribute.count;
  const itemSize = positionAttribute.itemSize;
  
  // Create a new Float32Array to hold our modified positions
  const newPositions = new Float32Array(count * itemSize);
  
  // Copy existing values from the position attribute but replace Y values
  for (let i = 0; i < count; i++) {
    const index = i * itemSize;
    
    // Safe way to access buffer values for all attribute types
    if (positionAttribute instanceof THREE.BufferAttribute || 
        positionAttribute instanceof THREE.InterleavedBufferAttribute) {
      // For standard buffer attributes, we can access the data directly
      for (let j = 0; j < itemSize; j++) {
        if (j === 1) { // Y component
          newPositions[index + j] = avgY + offset;
        } else {
          // Copy X and Z values as is
          newPositions[index + j] = positionAttribute.array[index + j];
        }
      }
    } else {
      // For GLBufferAttribute or other types, create a fallback method
      // This creates a default flat surface at the average height
      const stride = i * itemSize;
      newPositions[stride] = points[i % points.length].x;      // X
      newPositions[stride + 1] = avgY + offset;                // Y
      newPositions[stride + 2] = points[i % points.length].z;  // Z
    }
  }
  
  // Update the buffer with the new positions
  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, itemSize));
  
  // Create semi-transparent material for the area
  const material = new THREE.MeshBasicMaterial({
    color: 0x2196f3,
    opacity: 0.3,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.isAreaMesh = true;
  
  return mesh;
};

// Create a preview line for measurement tools
export const createPreviewLine = (startPoint: THREE.Vector3, endPoint: THREE.Vector3): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
  
  // Create dashed line material
  const material = new THREE.LineDashedMaterial({ 
    color: 0xffcc00,
    dashSize: 0.1,
    gapSize: 0.05,
    opacity: 0.7,
    transparent: true 
  });
  
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances(); // Required for dashed lines
  line.userData.isPreviewLine = true;
  
  return line;
};
