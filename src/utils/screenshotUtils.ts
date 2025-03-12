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

// Helper function to optimize image data (reduce size while preserving quality)
const optimizeImageData = async (
  dataUrl: string, 
  maxWidth: number = 800, 
  quality: number = 0.4, 
  targetDPI: number = 150
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Calculate the new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        // Calculate pixel dimensions for target DPI (150 DPI)
        // Reduce DPI factor for smaller file size
        const scaleFactor = targetDPI / 150; // Originally was 96, now using 150 as base
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = height * ratio;
        }
        
        // Apply scaled down DPI scaling for smaller file sizes
        const finalWidth = Math.round(width * scaleFactor);
        const finalHeight = Math.round(height * scaleFactor);
        
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Set DPI properly for moderate quality (reduced for performance)
        ctx.scale(scaleFactor, scaleFactor);
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium'; // Changed from 'high' to 'medium'
        
        // Draw the image with new dimensions
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to data URL with reduced quality JPEG for smaller files
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

// Exportiert Messungen als PDF mit Screenshots (Optimierte Version)
export const exportMeasurementsToPDF = async (
  measurements: Measurement[], 
  screenshots: { id: string, imageDataUrl: string, description: string }[] = []
): Promise<void> => {
  try {
    // Prüfen, ob Messungen vorhanden sind
    if (!measurements || measurements.length === 0) {
      throw new Error("Keine Messungen vorhanden");
    }
    
    // Verwende den korrekten Import
    const doc = new JsPDFModule({
      compress: true // Enable compression to reduce file size
    });
    
    // Konfiguration
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
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
    doc.setFontSize(16); // Reduced from 20 to 16
    doc.setFont('helvetica', 'bold');
    doc.text('Drohnenvermessung', margin + 20, margin + 10);
    
    // Datum
    doc.setFontSize(9); // Reduced from 10 to 9
    doc.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString('de-DE');
    doc.text(`Datum: ${date}`, pageWidth - margin - 40, margin + 10);
    
    // Trennlinie
    doc.setLineWidth(0.3); // Reduced from 0.5 to 0.3
    doc.line(margin, margin + 20, pageWidth - margin, margin + 20);
    
    let yPos = margin + 30;
    
    // Messungen Überschrift
    doc.setFontSize(14); // Reduced from 16 to 14
    doc.setFont('helvetica', 'bold');
    doc.text('Messungen', margin, yPos);
    yPos += 10;
    
    // Use autoTable for better performance and smaller file size
    const tableData = measurements.map(m => [
      m.description || '-',
      m.type === 'length' ? 'Länge' : 'Höhe',
      `${m.value.toFixed(2)} ${m.unit}`
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Beschreibung', 'Typ', 'Messwert']],
      body: tableData,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [66, 66, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
    
    // Get the Y position after the table
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Screenshots hinzufügen, falls vorhanden
    if (screenshots && screenshots.length > 0) {
      doc.setFontSize(14); // Reduced from 16 to 14
      doc.setFont('helvetica', 'bold');
      doc.text('Screenshots', margin, yPos);
      yPos += 10;
      
      // Process screenshots sequentially to avoid memory issues
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        
        // Optimize image before adding to PDF
        try {
          // Use 150 DPI and quality of 0.3 for smaller file size (reduced from 0.4)
          const optimizedDataUrl = await optimizeImageData(screenshot.imageDataUrl, 600, 0.3, 150);
          
          // Get dimensions of the optimized image to maintain aspect ratio
          const img = new Image();
          img.src = optimizedDataUrl;
          
          // Wait for image to load to get dimensions
          await new Promise<void>((resolve) => {
            img.onload = () => {
              // Check if we need a new page before adding the screenshot
              // Reserve space for the title + actual image + padding
              const titleHeight = 8; // Reduced from 10 to 8
              const aspectRatio = img.width / img.height;
              const imgWidth = contentWidth * 0.9; // 90% of content width to reduce file size
              const imgHeight = imgWidth / aspectRatio;
              const requiredSpace = titleHeight + imgHeight + 15; // Added some padding
            
              // Add a new page if this screenshot won't fit
              if (yPos + requiredSpace > pageHeight) {
                doc.addPage();
                yPos = margin; // Reset to the top of the new page
              }
              
              // Add screenshot title
              doc.setFontSize(10); // Reduced from 12 to 10
              doc.setFont('helvetica', 'bold');
              doc.text(`Screenshot ${i + 1}${screenshot.description ? ': ' + screenshot.description : ''}`, margin, yPos);
              yPos += titleHeight;
              
              // Add screenshot image with compression options
              try {
                doc.addImage(
                  optimizedDataUrl,
                  'JPEG',
                  margin + contentWidth * 0.05, // Center the image by adding 5% margin
                  yPos,
                  imgWidth,
                  imgHeight,
                  undefined,
                  'FAST', // Use FAST compression
                  0  // 0 rotation
                );
                
                yPos += imgHeight + 15; // Add space after the image
              } catch (addImageError) {
                console.warn(`Screenshot ${i + 1} konnte nicht hinzugefügt werden:`, addImageError);
                yPos += 5; // Add a bit of space even if the image fails
              }
              
              resolve();
            };
            
            img.onerror = () => {
              console.warn(`Screenshot ${i + 1} konnte nicht geladen werden`);
              resolve();
            };
          });
        } catch (imgError) {
          console.warn(`Screenshot ${i + 1} konnte nicht verarbeitet werden:`, imgError);
          yPos += 5;
        }
      }
    }
    
    // PDF speichern
    doc.save('drohnenvermessung.pdf');
  } catch (error) {
    console.error("Fehler beim Exportieren als PDF:", error);
    throw error;
  }
};
