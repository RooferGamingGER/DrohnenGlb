
import * as THREE from 'three';
import { loadTexture, BackgroundOption } from '@/utils/modelUtils';

export const applyBackground = async (
  option: BackgroundOption,
  sceneRefs: {
    scene: THREE.Scene | null;
    renderer: THREE.WebGLRenderer | null;
  }
): Promise<void> => {
  if (!sceneRefs.scene || !sceneRefs.renderer) return;

  // Clear existing background
  if (sceneRefs.scene.background) {
    if (sceneRefs.scene.background instanceof THREE.Texture) {
      sceneRefs.scene.background.dispose();
    }
    sceneRefs.scene.background = null;
  }

  // Set transparency if needed
  sceneRefs.renderer.setClearAlpha(option.id === 'transparent' ? 0 : 1);

  // Apply color or texture background
  if (option.color) {
    sceneRefs.scene.background = new THREE.Color(option.color);
  } else if (option.texture) {
    try {
      const texture = await loadTexture(option.texture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);
      sceneRefs.scene.background = texture;
    } catch (error) {
      console.error('Error loading texture:', error);
    }
  }
};
