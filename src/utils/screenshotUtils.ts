
import * as THREE from 'three';
import { Measurement } from './measurementUtils';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
// Import correctly with named import
import { jsPDF as JsPDFModule } from "jspdf";
import autoTable from 'jspdf-autotable';

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

// Exportiert Messungen als Word-Dokument (docx) - als Alternative zum PDF
export const exportMeasurementsToWord = (
  measurements: Measurement[],
  screenshots: { id: string, imageDataUrl: string, description: string }[] = []
): void => {
  // Da wir keine direkte Word-Export-Bibliothek verwenden, erstellen wir ein HTML-Dokument
  // und speichern es als HTML-Datei, die in Word geöffnet werden kann
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Drohnenvermessung</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        th { background-color: #f2f2f2; text-align: left; }
        .screenshot { margin-bottom: 20px; }
        .screenshot img { max-width: 100%; height: auto; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h1>Drohnenvermessung</h1>
      <p>Datum: ${new Date().toLocaleDateString('de-DE')}</p>
      
      <h2>Messungen</h2>
      <table>
        <thead>
          <tr>
            <th>Beschreibung</th>
            <th>Typ</th>
            <th>Messwert</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  measurements.forEach(m => {
    htmlContent += `
      <tr>
        <td>${m.description || '-'}</td>
        <td>${m.type === 'length' ? 'Länge' : 'Höhe'}</td>
        <td>${m.value.toFixed(2)} ${m.unit}</td>
      </tr>
    `;
  });
  
  htmlContent += `
        </tbody>
      </table>
  `;
  
  if (screenshots && screenshots.length > 0) {
    htmlContent += `<h2>Screenshots</h2>`;
    
    screenshots.forEach((screenshot, index) => {
      htmlContent += `
        <div class="screenshot">
          <h3>Screenshot ${index + 1}${screenshot.description ? ': ' + screenshot.description : ''}</h3>
          <img src="${screenshot.imageDataUrl}" alt="Screenshot ${index + 1}">
        </div>
      `;
    });
  }
  
  htmlContent += `
    </body>
    </html>
  `;
  
  // Erstellen eines Blob mit dem HTML-Inhalt
  const blob = new Blob([htmlContent], { type: 'text/html' });
  
  // Download als .html-Datei
  saveAs(blob, 'drohnenvermessung.html');
};

// Exportiert Messungen als PDF mit Screenshots (Korrigierte Version)
export const exportMeasurementsToPDF = (
  measurements: Measurement[], 
  screenshots: { id: string, imageDataUrl: string, description: string }[] = []
): void => {
  try {
    // Prüfen, ob Messungen vorhanden sind
    if (!measurements || measurements.length === 0) {
      throw new Error("Keine Messungen vorhanden");
    }
    
    // Verwende den korrekten Import
    const doc = new JsPDFModule();
    
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
    
    // Messungstabelle erstellen - manuelle Implementierung ohne autoTable
    const cellPadding = 5;
    const colWidths = [contentWidth * 0.5, contentWidth * 0.2, contentWidth * 0.3];
    const rowHeight = 10;
    
    // Tabellenkopf zeichnen
    doc.setFillColor(66, 66, 66);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
    
    doc.setFontSize(10);
    doc.text('Beschreibung', margin + cellPadding, yPos + rowHeight - cellPadding/2);
    doc.text('Typ', margin + colWidths[0] + cellPadding, yPos + rowHeight - cellPadding/2);
    doc.text('Messwert', margin + colWidths[0] + colWidths[1] + cellPadding, yPos + rowHeight - cellPadding/2);
    
    yPos += rowHeight;
    
    // Tabelleninhalt zeichnen
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);
    
    measurements.forEach((m, index) => {
      const isEvenRow = index % 2 === 0;
      
      if (isEvenRow) {
        doc.setFillColor(245, 245, 245);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      
      doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, yPos, contentWidth, rowHeight, 'S');
      
      const description = m.description || '-';
      const type = m.type === 'length' ? 'Länge' : 'Höhe';
      const value = `${m.value.toFixed(2)} ${m.unit}`;
      
      doc.text(description, margin + cellPadding, yPos + rowHeight - cellPadding/2);
      doc.text(type, margin + colWidths[0] + cellPadding, yPos + rowHeight - cellPadding/2);
      doc.text(value, margin + colWidths[0] + colWidths[1] + cellPadding, yPos + rowHeight - cellPadding/2);
      
      yPos += rowHeight;
    });
    
    yPos += 15;
    
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
