
import * as THREE from 'three';
import { Measurement, MeasurementType } from '../measurementUtils';

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
export { Measurement, MeasurementType };
