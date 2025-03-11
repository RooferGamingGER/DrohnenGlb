
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
  segmentValues?: number[]; // Added for multi-point measurements
  unit: string;
  description?: string;
  isActive?: boolean;
  labelObject?: THREE.Sprite; // Reference to the 3D label
  labelObjects?: THREE.Sprite[]; // References to segment labels for multi-point measurements
  lineObjects?: THREE.Line[]; // References to the 3D lines
  pointObjects?: THREE.Mesh[]; // References to the 3D points
}

// Calculate distance between two points in 3D space
export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

// Calculate total distance of a path with multiple points
export const calculatePathDistance = (points: THREE.Vector3[]): number => {
  if (points.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += calculateDistance(points[i], points[i + 1]);
  }
  
  return totalDistance;
};

// Calculate individual segment distances in a multi-point path
export const calculateSegmentDistances = (points: THREE.Vector3[]): number[] => {
  if (points.length < 2) return [];
  
  const segments: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(calculateDistance(points[i], points[i + 1]));
  }
  
  return segments;
};

// Calculate height difference (y-axis) between two points
export const calculateHeight = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return Math.abs(p2.y - p1.y);
};

// Format measurement value with appropriate unit
export const formatMeasurement = (value: number, type: MeasurementType): string => {
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
  canvas.width = 512; // Doubled for better text clarity
  canvas.height = 128; // Doubled for better text clarity
  
  // Set a solid background with rounded corners
  context.fillStyle = 'rgba(0, 0, 0, 0.9)'; // More opaque background
  context.roundRect(0, 0, canvas.width, canvas.height, 16);
  context.fill();
  
  // Add border for better visibility
  context.strokeStyle = 'white';
  context.lineWidth = 4;
  context.roundRect(2, 2, canvas.width-4, canvas.height-4, 14);
  context.stroke();
  
  // Set text properties with improved rendering
  context.font = 'bold 48px Arial, sans-serif'; // Larger font, better font
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
  sprite.scale.set(0.8, 0.4, 1); // Increased base scale for better readability
  
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

// Create a material for draggable point visualization
export const createDraggablePointMaterial = (isHovered: boolean = false): THREE.MeshBasicMaterial => {
  return new THREE.MeshBasicMaterial({
    color: isHovered ? 0xffcc00 : 0xff0000,
    transparent: true,
    opacity: 0.8
  });
};

// Create a mesh for a measurement point
export const createDraggablePointMesh = (position: THREE.Vector3): THREE.Mesh => {
  const geometry = new THREE.SphereGeometry(0.03, 16, 16);
  const material = createDraggablePointMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  return mesh;
};
