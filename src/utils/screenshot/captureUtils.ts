
import * as THREE from 'three';

/**
 * Captures a screenshot from the THREE.js renderer
 */
export const captureScreenshot = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  isMobile: boolean = false
): string | null => {
  try {
    // Ensure the scene is rendered once before capture
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    return dataUrl;
  } catch (error) {
    console.error("Error capturing screenshot:", error);
    return null;
  }
};

/**
 * Converts a data URL to a Blob
 */
export const dataURLToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

/**
 * Safely dispose of Three.js materials
 */
export const safelyDisposeMaterial = (material: THREE.Material | THREE.Material[] | null): void => {
  if (!material) return;
  
  try {
    if (Array.isArray(material)) {
      material.forEach(mat => {
        safelyDisposeMaterial(mat);
      });
    } else {
      // Handle textures by checking if they exist first
      // For MeshBasicMaterial, MeshStandardMaterial, etc. with map property
      if ('map' in material && material.map instanceof THREE.Texture) {
        material.map.dispose();
      }
      if ('lightMap' in material && material.lightMap instanceof THREE.Texture) {
        material.lightMap.dispose();
      }
      if ('bumpMap' in material && material.bumpMap instanceof THREE.Texture) {
        material.bumpMap.dispose();
      }
      if ('normalMap' in material && material.normalMap instanceof THREE.Texture) {
        material.normalMap.dispose();
      }
      if ('specularMap' in material && material.specularMap instanceof THREE.Texture) {
        material.specularMap.dispose();
      }
      if ('envMap' in material && material.envMap instanceof THREE.Texture) {
        material.envMap.dispose();
      }
      
      // Dispose the material itself
      material.dispose();
    }
  } catch (error) {
    console.error("Error disposing material:", error);
  }
};

/**
 * Safely dispose of Three.js geometries
 */
export const safelyDisposeGeometry = (geometry: THREE.BufferGeometry | null): void => {
  if (!geometry) return;
  
  try {
    // Dispose the geometry
    geometry.dispose();
  } catch (error) {
    console.error("Error disposing geometry:", error);
  }
};

/**
 * Safely dispose of Three.js objects (recursively)
 */
export const safelyDisposeObject = (object: THREE.Object3D | null): void => {
  if (!object) return;
  
  try {
    // Recursively process all children
    while (object.children.length > 0) {
      safelyDisposeObject(object.children[0]);
      object.remove(object.children[0]);
    }
    
    // Dispose geometries and materials
    if (object instanceof THREE.Mesh) {
      safelyDisposeGeometry(object.geometry);
      safelyDisposeMaterial(object.material);
    } else if (object instanceof THREE.Line) {
      safelyDisposeGeometry(object.geometry);
      safelyDisposeMaterial(object.material);
    }
  } catch (error) {
    console.error("Error disposing object:", error);
  }
};

/**
 * Optimizes image data for better quality and file size
 */
export const optimizeImageData = async (
  dataUrl: string, 
  maxWidth: number = 1200, 
  quality: number = 0.92, 
  targetDPI: number = 300, 
  forceLandscape: boolean = false
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        let width = img.width;
        let height = img.height;
        
        if (forceLandscape && height > width) {
          const temp = width;
          width = height;
          height = temp;
        }
        
        const scaleFactor = targetDPI / 150;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        
        const finalWidth = Math.round(width * scaleFactor);
        const finalHeight = Math.round(height * scaleFactor);
        
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.scale(scaleFactor, scaleFactor);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        if (forceLandscape && img.height > img.width) {
          ctx.save();
          ctx.translate(width, 0);
          ctx.rotate(90 * Math.PI / 180);
          ctx.drawImage(img, 0, 0, height, width);
          ctx.restore();
        } else {
          ctx.drawImage(img, 0, 0, width, height);
        }
        
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(optimizedDataUrl);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = dataUrl;
    } catch (error) {
      reject(error);
    }
  });
};
