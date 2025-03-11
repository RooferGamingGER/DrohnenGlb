
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
  
  // Project points onto XZ plane for area calculation
  const projectedPoints = points.map(p => new THREE.Vector2(p.x, p.z));
  
  let area = 0;
  for (let i = 0; i < projectedPoints.length; i++) {
    const j = (i + 1) % projectedPoints.length;
    area += projectedPoints[i].x * projectedPoints[j].y;
    area -= projectedPoints[j].x * projectedPoints[i].y;
  }
  
  return Math.abs(area) / 2;
};

// Format measurement value with appropriate unit
export const formatMeasurement = (value: number, type: MeasurementType): string => {
  if (type === 'area') {
    return `${value.toFixed(2)} m²`;
  } else {
    return `${value.toFixed(2)} m`;
  }
};

// Create a unique ID for measurements
export const createMeasurementId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};
