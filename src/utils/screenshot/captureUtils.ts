
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
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  return dataUrl;
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
