
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
  areaObject?: THREE.Mesh; // Reference to the 3D area plane
}

// Calculate distance between two points in 3D space
export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

// Calculate height difference (y-axis) between two points
export const calculateHeight = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return Math.abs(p2.y - p1.y);
};

// Calculate area of a polygon defined by an array of points
export const calculateArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  // Project points onto a plane for area calculation
  // For roofs, we'll use the XZ plane (ignoring Y/height differences)
  let area = 0;
  
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    // Cross product of vectors to get area contribution
    // Using the Shoelace formula for polygon area
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area) / 2;
};

// Create a polygon mesh from points
export const createAreaMesh = (
  points: THREE.Vector3[], 
  color: number = 0x3b82f6,
  opacity: number = 0.4
): THREE.Mesh => {
  // Create a shape from the points
  const shape = new THREE.Shape();
  
  // Start the shape at the first point
  shape.moveTo(points[0].x, points[0].z);
  
  // Add lines to each subsequent point
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].z);
  }
  
  // Close the shape
  shape.lineTo(points[0].x, points[0].z);
  
  // Create geometry from the shape
  const geometry = new THREE.ShapeGeometry(shape);
  
  // Rotate to lay flat on the XZ plane
  geometry.rotateX(-Math.PI / 2);
  
  // Calculate average height of all points for Y position
  const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  
  // Create material with transparency
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  
  // Create and position the mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = avgY + 0.01; // Slightly above the surface to avoid z-fighting
  
  return mesh;
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

// Create a material for preview lines during measurement
export const createPreviewLineMaterial = (type: MeasurementType): THREE.LineBasicMaterial => {
  const color = type === 'length' ? 0x00ff00 : 
               type === 'height' ? 0x0000ff : 
               0x3b82f6; // blue for area
               
  return new THREE.LineBasicMaterial({ 
    color: color,
    linewidth: 2,
    transparent: true,
    opacity: 0.7
  });
};

// Get the color for a measurement type
export const getMeasurementColor = (type: MeasurementType): number => {
  switch (type) {
    case 'length': return 0x00ff00; // green
    case 'height': return 0x0000ff; // blue
    case 'area': return 0x3b82f6;   // blue
    default: return 0xffffff;       // white
  }
};
