
import * as THREE from 'three';

export interface ScreenshotData {
  imageDataUrl: string;
  description: string;
}

export interface Screenshot {
  id: string;
  imageDataUrl: string;
  description: string;
  filename?: string;
}

// Re-export the measurement types for consistency
export type { Measurement, MeasurementType } from '../measurementUtils';
