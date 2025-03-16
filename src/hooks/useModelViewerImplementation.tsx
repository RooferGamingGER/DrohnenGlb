
import { useCallback, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useModelViewer } from './useModelViewer';
import { Measurement, MeasurementType } from '@/utils/measurementUtils';

export interface ModelViewerImplementation {
  // State
  isLoading: boolean;
  progress: number;
  error: string | null;
  loadedModel: THREE.Group | null;
  measurements: Measurement[];
  tempPoints: any[];
  activeTool: MeasurementType;
  canUndo: boolean;
  
  // References to Three.js objects
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  controls: any | null;
  
  // Methods
  setProgress: (progress: number) => void;
  loadModel: (file: File) => Promise<void>;
  resetView: () => void;
  clearMeasurements: () => void;
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  toggleMeasurementsVisibility: (visible: boolean) => void;
  deleteTempPoint: (index: number) => void;
  deleteSinglePoint: (measurementId: string, pointIndex: number) => void;
  deleteMeasurement: (id: string) => void;
  undoLastPoint: () => void;
  setActiveTool: (tool: MeasurementType) => void;
  finalizeMeasurement: any;
}

export const useModelViewerImplementation = (props: Parameters<typeof useModelViewer>[0]): ModelViewerImplementation => {
  const modelViewer = useModelViewer(props);
  
  return {
    // State
    isLoading: modelViewer.state.isLoading,
    progress: modelViewer.state.progress,
    error: modelViewer.state.error,
    loadedModel: modelViewer.loadedModel,
    measurements: modelViewer.measurements,
    tempPoints: modelViewer.tempPoints,
    activeTool: modelViewer.activeTool,
    canUndo: modelViewer.canUndo,
    
    // References to Three.js objects
    scene: modelViewer.scene,
    camera: modelViewer.camera,
    renderer: modelViewer.renderer,
    controls: modelViewer.controls,
    
    // Methods
    setProgress: modelViewer.setProgress,
    loadModel: modelViewer.loadModel,
    resetView: modelViewer.resetView,
    clearMeasurements: modelViewer.clearMeasurements,
    updateMeasurement: modelViewer.updateMeasurement,
    toggleMeasurementsVisibility: modelViewer.toggleMeasurementsVisibility,
    deleteTempPoint: modelViewer.deleteTempPoint,
    deleteSinglePoint: modelViewer.deleteSinglePoint,
    deleteMeasurement: modelViewer.deleteMeasurement,
    undoLastPoint: modelViewer.undoLastPoint,
    setActiveTool: modelViewer.setActiveTool,
    finalizeMeasurement: modelViewer.finalizeMeasurement,
  };
};
