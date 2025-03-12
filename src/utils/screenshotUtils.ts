
import * as THREE from 'three';
import { Measurement } from './measurementUtils';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  // Render the current scene to capture the current state exactly
  renderer.render(scene, camera);
  
  // Capture the WebGL canvas content
  const dataUrl = renderer.domElement.toDataURL('image/png');
  
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

// Exportiert Messungen als PDF mit Screenshots
export const exportMeasurementsToPDF = (
  measurements: Measurement[], 
  screenshots: { id: string, imageDataUrl: string, description: string }[] = []
): void => {
  try {
    // Prüfen, ob Messungen vorhanden sind
    if (!measurements || measurements.length === 0) {
      throw new Error("Keine Messungen vorhanden");
    }
    
    const doc = new jsPDF();
    
    // Konfiguration
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    
    // Füge Logo und Überschrift hinzu
    try {
      const logoSize = 15;
      const logoImg = new Image();
      logoImg.src = '/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png';
      
      doc.addImage(
        logoImg, 
        'PNG', 
        margin, 
        margin, 
        logoSize, 
        logoSize
      );
    } catch (logoError) {
      console.warn("Logo konnte nicht geladen werden:", logoError);
      // Fahre ohne Logo fort
    }
    
    // Überschrift
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Drohnenvermessung', margin + 20, margin + 10);
    
    // Datum
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString('de-DE');
    doc.text(`Datum: ${date}`, pageWidth - margin - 40, margin + 10);
    
    // Trennlinie
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 20, pageWidth - margin, margin + 20);
    
    let yPos = margin + 30;
    
    // Messungen Überschrift
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Messungen', margin, yPos);
    yPos += 10;
    
    // Messungstabelle erstellen
    const tableData = measurements.map(m => [
      m.description || '-',
      m.type === 'length' ? 'Länge' : 'Höhe',
      `${m.value.toFixed(2)} ${m.unit}`
    ]);
    
    // @ts-ignore - jsPDF-autotable typings are not complete
    doc.autoTable({
      startY: yPos,
      head: [['Beschreibung', 'Typ', 'Messwert']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.5 },
        1: { cellWidth: contentWidth * 0.2 },
        2: { cellWidth: contentWidth * 0.3 }
      }
    });
    
    // @ts-ignore - Typings issue with .lastAutoTable
    yPos = doc.lastAutoTable.finalY + 15;
    
    // Screenshots hinzufügen, falls vorhanden
    if (screenshots && screenshots.length > 0) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Screenshots', margin, yPos);
      yPos += 10;
      
      const imgWidth = contentWidth;
      const imgHeight = 80;
      
      screenshots.forEach((screenshot, index) => {
        // Prüfen, ob ein Seitenumbruch nötig ist
        if (yPos + imgHeight + 30 > doc.internal.pageSize.getHeight()) {
          doc.addPage();
          yPos = margin;
        }
        
        try {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`Screenshot ${index + 1}${screenshot.description ? ': ' + screenshot.description : ''}`, margin, yPos);
          yPos += 5;
          
          doc.addImage(
            screenshot.imageDataUrl,
            'PNG',
            margin,
            yPos,
            imgWidth,
            imgHeight
          );
          
          yPos += imgHeight + 15;
        } catch (imgError) {
          console.warn(`Screenshot ${index + 1} konnte nicht hinzugefügt werden:`, imgError);
          yPos += 5;
        }
      });
    }
    
    // PDF speichern
    doc.save('drohnenvermessung.pdf');
  } catch (error) {
    console.error("Fehler beim Exportieren als PDF:", error);
    throw error;
  }
};
