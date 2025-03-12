
// This file exports all screenshot-related utilities from their dedicated modules
import { captureScreenshot } from './screenshot/captureUtils';
import { saveScreenshot } from './screenshot/fileUtils';
import { exportMeasurementsToExcel } from './screenshot/excelExport';
import { exportMeasurementsToWord } from './screenshot/wordExport';
import { exportMeasurementsToPDF } from './screenshot/pdfExport';
import type { ScreenshotData } from './screenshot/types';

export {
  captureScreenshot,
  saveScreenshot,
  exportMeasurementsToExcel,
  exportMeasurementsToWord,
  exportMeasurementsToPDF
};

// Re-export types with the proper syntax
export type { ScreenshotData };
