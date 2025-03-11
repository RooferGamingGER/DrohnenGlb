
import * as THREE from 'three';
import { loadGLBModel, centerModel } from '@/utils/modelUtils';
import { ModelSceneRefs, ProcessingState, ModelViewerState } from '@/types/modelViewerTypes';
import { useToast } from '@/hooks/use-toast';

export const loadAndProcessModel = async (
  file: File,
  sceneRefs: ModelSceneRefs,
  processingState: ProcessingState,
  setState: React.Dispatch<React.SetStateAction<ModelViewerState>>,
  toastFunction: ReturnType<typeof useToast>['toast']
): Promise<THREE.Group> => {
  try {
    if (!sceneRefs.scene) throw new Error('Scene not initialized');

    // Remove existing model if present
    if (sceneRefs.model && sceneRefs.scene) {
      sceneRefs.scene.remove(sceneRefs.model);
      sceneRefs.model = null;
    }

    // Clear any existing processing interval
    if (processingState.processingInterval) {
      clearInterval(processingState.processingInterval);
      processingState.processingInterval = null;
    }

    // Set initial loading state
    setState({
      isLoading: true,
      progress: 0,
      error: null,
      loadedModel: null,
    });

    processingState.uploadProgress = 0;

    // Load the model with progress tracking
    const model = await loadGLBModel(
      file,
      (event) => {
        if (event.lengthComputable) {
          const uploadPercentage = Math.round((event.loaded / event.total) * 100);
          processingState.uploadProgress = uploadPercentage;
          const scaledProgress = Math.floor(uploadPercentage * 0.7);
          setState(prev => ({ ...prev, progress: scaledProgress }));
        }
      }
    );

    // Update progress for processing phase
    setState(prev => ({ ...prev, progress: 70 }));
    processingState.processingStartTime = Date.now();
    
    const estimatedProcessingTime = 3000;
    
    processingState.processingInterval = window.setInterval(() => {
      const elapsedTime = Date.now() - (processingState.processingStartTime || 0);
      const processingProgress = Math.min(
        Math.floor(70 + (elapsedTime / estimatedProcessingTime) * 30), 
        99
      );
      
      setState(prev => ({ ...prev, progress: processingProgress }));
      
      if (processingProgress >= 99) {
        if (processingState.processingInterval) {
          clearInterval(processingState.processingInterval);
          processingState.processingInterval = null;
        }
      }
    }, 100);

    // Center and position the model
    const box = centerModel(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    model.rotation.x = -Math.PI / 2;

    if (sceneRefs.camera && sceneRefs.controls) {
      const distance = size * 1.5;
      
      sceneRefs.camera.position.set(0, 0, 0);
      sceneRefs.camera.position.copy(center);
      sceneRefs.camera.position.z += distance;
      sceneRefs.camera.lookAt(center);

      sceneRefs.controls.target.copy(center);
      sceneRefs.controls.update();
      sceneRefs.controls.saveState();
    }

    // Add model to scene
    sceneRefs.scene.add(model);
    sceneRefs.model = model;

    // Clear any remaining interval
    if (processingState.processingInterval) {
      clearInterval(processingState.processingInterval);
      processingState.processingInterval = null;
    }

    // Update state with loaded model
    setState({
      isLoading: false,
      progress: 100,
      error: null,
      loadedModel: model,
    });

    // Show success toast
    toastFunction({
      title: "Modell geladen",
      description: "Das 3D-Modell wurde erfolgreich geladen. Sie können es jetzt von allen Seiten betrachten.",
      duration: 3000,
    });

    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    
    if (processingState.processingInterval) {
      clearInterval(processingState.processingInterval);
      processingState.processingInterval = null;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    setState({
      isLoading: false,
      progress: 0,
      error: `Fehler beim Laden des Modells: ${errorMessage}`,
      loadedModel: null,
    });
    
    toastFunction({
      title: "Fehler beim Laden",
      description: `Das Modell konnte nicht geladen werden: ${errorMessage}`,
      variant: "destructive",
      duration: 5000,
    });

    throw error;
  }
};

export const resetModelView = (
  sceneRefs: ModelSceneRefs
): void => {
  if (sceneRefs.controls && sceneRefs.model && sceneRefs.camera) {
    const box = new THREE.Box3().setFromObject(sceneRefs.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    
    const distance = size * 1.5;
    sceneRefs.camera.position.copy(center);
    sceneRefs.camera.position.z += distance;
    sceneRefs.camera.lookAt(center);
    
    sceneRefs.controls.target.copy(center);
    sceneRefs.controls.update();
  }
};
