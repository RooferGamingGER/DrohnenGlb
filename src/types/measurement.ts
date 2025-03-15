
import * as THREE from 'three';

export type MeasurementType = 'none' | 'length' | 'height';

export interface MeasurementPoint {
  position: THREE.Vector3;
  worldPosition: THREE.Vector3;
  mesh?: THREE.Mesh;
}

export interface Measurement {
  id: string;
  type: MeasurementType;
  points: MeasurementPoint[];
  value: number;
  unit: string;
  description?: string;
  visible?: boolean;
  editMode?: boolean;
  inclination?: number;
  line?: THREE.Line;
}

export const isInclinationSignificant = (inclination: number): boolean => {
  return Math.abs(inclination) > 2.0; // Significant if more than 2 degrees
};
