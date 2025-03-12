
import * as THREE from 'three';
import { Measurement } from './measurementUtils';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export interface ScreenshotData {
  imageDataUrl: string;
  description: string;
}

// Erstellt einen Screenshot und gibt diesen als Data URL zurück
export const captureScreenshot = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): string => {
  // Aktuellen Renderer-Größe merken
  const originalSize = {
    width: renderer.domElement.width,
    height: renderer.domElement.height
  };

  // Renderer auf viewport-Größe anpassen für bessere Qualität
  const pixelRatio = window.devicePixelRatio;
  renderer.setSize(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio, false);
  renderer.setPixelRatio(1);
  
  // Scene rendern
  renderer.render(scene, camera);
  
  // Screenshot als DataURL erstellen
  const dataUrl = renderer.domElement.toDataURL('image/png');
  
  // Renderer auf originale Größe zurücksetzen
  renderer.setSize(originalSize.width, originalSize.height, false);
  renderer.setPixelRatio(pixelRatio);
  
  return dataUrl;
};

// Speichert einen Screenshot als PNG-Datei
export const saveScreenshot = (dataUrl: string, filename: string = 'screenshot.png'): void => {
  // File-saver Bibliothek verwenden um den Screenshot zu speichern
  const blob = dataURLToBlob(dataUrl);
  saveAs(blob, filename);
};

// Konvertiert eine Data URL in einen Blob
const dataURLToBlob = (dataURL: string): Blob => {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

// Exportiert Messungen als Excel-Datei
export const exportMeasurementsToExcel = (measurements: Measurement[]): void => {
  // Daten vorbereiten
  const data = measurements.map(m => ({
    'Beschreibung': m.description || '-',
    'Typ': m.type === 'length' ? 'Länge' : 'Höhe',
    'Wert': m.value,
    'Einheit': m.unit
  }));

  // Arbeitsmappe erstellen
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Anpassen der Spaltenbreiten
  const columnWidths = [
    { wch: 30 }, // Beschreibung
    { wch: 10 }, // Typ
    { wch: 10 }, // Wert
    { wch: 10 }  // Einheit
  ];
  ws['!cols'] = columnWidths;

  // Worksheet zur Arbeitsmappe hinzufügen
  XLSX.utils.book_append_sheet(wb, ws, 'Messungen');

  // Als Excel-Datei herunterladen
  XLSX.writeFile(wb, 'messungen.xlsx');
};
