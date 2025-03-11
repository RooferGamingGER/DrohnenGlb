
import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BackgroundOption, backgroundOptions } from '@/utils/modelUtils';
import { useToast } from '@/hooks/use-toast';
import { ModelViewerState, UseModelViewerProps, ModelSceneRefs, ProcessingState } from '@/types/modelViewerTypes';
import { initializeScene, setupAnimationLoop, cleanupScene, handleResize } from '@/utils/sceneSetup';
import { loadAndProcessModel, resetModelView } from '@/utils/modelManagement';
import { applyBackground } from '@/utils/backgroundManager';

export const useModelViewer = ({ containerRef }: UseModelViewerProps) => {
  const { toast } = useToast();
  const [state, setState] = useState<ModelViewerState>({
    isLoading: false,
    progress: 0,
    error: null,
    loadedModel: null,
  });
  
  const [background, setBackground] = useState<BackgroundOption>(
    backgroundOptions.find(bg => bg.id === 'dark') || backgroundOptions[0]
  );

  // Create refs for scene elements
  const sceneRefs = useRef<ModelSceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    lights: null,
    requestId: null,
    model: null,
  }).current;

  // Create refs for processing state
  const processingState = useRef<ProcessingState>({
    processingStartTime: null,
    uploadProgress: 0,
    processingInterval: null,
  }).current;

  // Set up scene and animation loop
  useEffect(() => {
    initializeScene(containerRef, sceneRefs);

    const animate = () => {
      if (sceneRefs.controls) {
        sceneRefs.controls.update();
      }
      
      if (sceneRefs.renderer && sceneRefs.scene && sceneRefs.camera) {
        sceneRefs.renderer.render(sceneRefs.scene, sceneRefs.camera);
      }
      
      sceneRefs.requestId = requestAnimationFrame(animate);
    };
    
    setupAnimationLoop(sceneRefs, animate);

    // Handle window resizing
    const handleWindowResize = () => handleResize(containerRef, sceneRefs);
    window.addEventListener('resize', handleWindowResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      cleanupScene(containerRef, sceneRefs);
      
      if (processingState.processingInterval) {
        clearInterval(processingState.processingInterval);
        processingState.processingInterval = null;
      }
    };
  }, []);

  // Function to load a model file
  const loadModel = async (file: File) => {
    try {
      const model = await loadAndProcessModel(file, sceneRefs, processingState, setState, toast);
      
      // Apply default background
      await applyBackgroundWrapper(
        backgroundOptions.find(bg => bg.id === 'dark') || backgroundOptions[0]
      );
      
      return model;
    } catch (error) {
      throw error;
    }
  };

  // Wrapper function for applying background
  const applyBackgroundWrapper = async (option: BackgroundOption) => {
    await applyBackground(option, {
      scene: sceneRefs.scene,
      renderer: sceneRefs.renderer
    });
    setBackground(option);
  };

  return {
    ...state,
    loadModel,
    background,
    setBackground: applyBackgroundWrapper,
    backgroundOptions,
    resetView: () => resetModelView(sceneRefs),
  };
};
