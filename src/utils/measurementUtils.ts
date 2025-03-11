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
  areaObject?: THREE.Mesh; // Reference to the area mesh for area measurements
}

// Calculate distance between two points in 3D space
export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

// Calculate height difference (y-axis) between two points
export const calculateHeight = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return Math.abs(p2.y - p1.y);
};

// Calculate area of a polygon defined by points in 3D space
export const calculateArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  // Use 3D triangulation for proper area calculation
  let totalArea = 0;
  const firstPoint = points[0];
  
  // Triangulate the polygon (fan triangulation from first point)
  for (let i = 1; i < points.length - 1; i++) {
    const triangle = [
      firstPoint,
      points[i],
      points[i + 1]
    ];
    
    // Calculate the area of this 3D triangle
    totalArea += calculate3DTriangleArea(triangle);
  }
  
  return totalArea;
};

// Helper function to calculate the area of a 3D triangle using cross product
const calculate3DTriangleArea = (triangle: THREE.Vector3[]): number => {
  if (triangle.length !== 3) return 0;
  
  // Create vectors for two sides of the triangle
  const v1 = new THREE.Vector3().subVectors(triangle[1], triangle[0]);
  const v2 = new THREE.Vector3().subVectors(triangle[2], triangle[0]);
  
  // Cross product gives a vector whose length is 2x the area
  const crossProduct = new THREE.Vector3().crossVectors(v1, v2);
  
  // Half the magnitude of the cross product is the area
  return crossProduct.length() / 2;
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
export const createTextSprite = (text: string, position: THREE.Vector3, color: number = 0x1e88e5): THREE.Sprite => {
  // Create canvas for texture
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Could not get canvas context");
  
  // Increase canvas size for better resolution
  canvas.width = 512; 
  canvas.height = 128;
  
  // Set a solid background with rounded corners
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.roundRect(0, 0, canvas.width, canvas.height, 16);
  context.fill();
  
  // Add border for better visibility
  context.strokeStyle = '#1e88e5';
  context.lineWidth = 4;
  context.roundRect(2, 2, canvas.width-4, canvas.height-4, 14);
  context.stroke();
  
  // Use the Inter font which is used in the UI (from index.css)
  context.font = 'bold 48px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // Add text shadow for better contrast
  context.shadowColor = 'rgba(0, 0, 0, 0.2)';
  context.shadowBlur = 4;
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 1;
  
  // Draw text
  context.fillStyle = '#1e88e5';
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
    color: isHovered ? 0x1e88e5 : 0x1e88e5,
    opacity: isHovered ? 0.8 : 1.0,
    transparent: true
  });
};

// Create line material for measurements
export const createMeasurementLineMaterial = (type: MeasurementType): THREE.LineBasicMaterial => {
  return new THREE.LineBasicMaterial({ 
    color: 0x1e88e5,
    linewidth: 2,
    depthTest: true
  });
};

// Create temporary line material for active measurements
export const createTemporaryLineMaterial = (): THREE.LineBasicMaterial => {
  return new THREE.LineBasicMaterial({ 
    color: 0x1e88e5,
    linewidth: 2,
    opacity: 0.7,
    transparent: true,
    depthTest: true
  });
};

// Create material for area measurements
export const createAreaMaterial = (): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({
    color: 0x1e88e5,
    opacity: 0.3,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
};

