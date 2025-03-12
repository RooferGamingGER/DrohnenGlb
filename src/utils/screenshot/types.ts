
import * as THREE from 'three';
import { Measurement } from '../measurementUtils';

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
