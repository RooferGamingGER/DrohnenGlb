
import { saveAs } from 'file-saver';
import { dataURLToBlob } from './captureUtils';

/**
 * Saves a screenshot to disk
 */
export const saveScreenshot = (dataUrl: string, filename: string = 'screenshot.png'): void => {
  const blob = dataURLToBlob(dataUrl);
  saveAs(blob, filename);
};
