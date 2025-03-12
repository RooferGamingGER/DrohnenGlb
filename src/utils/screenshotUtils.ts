
import * as THREE from 'three';
import { Measurement } from './measurementUtils';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { jsPDF as JsPDFModule } from "jspdf";
import autoTable from 'jspdf-autotable';

export interface ScreenshotData {
  imageDataUrl: string;
  description: string;
}

export const captureScreenshot = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): string => {
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  return dataUrl;
};

export const saveScreenshot = (dataUrl: string, filename: string = 'screenshot.png'): void => {
  const blob = dataURLToBlob(dataUrl);
  saveAs(blob, filename);
};

const dataURLToBlob = (dataUrl: string): Blob => {
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

const optimizeImageData = async (
  dataUrl: string, 
  maxWidth: number = 800, 
  quality: number = 0.8, 
  targetDPI: number = 250
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        let width = img.width;
        let height = img.height;
        
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
        
        ctx.drawImage(img, 0, 0, width, height);
        
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

export const exportMeasurementsToExcel = (measurements: Measurement[]): void => {
  const data = measurements.map(m => ({
    'Beschreibung': m.description || '-',
    'Typ': m.type === 'length' ? 'Länge' : 'Höhe',
    'Wert': m.value,
    'Einheit': m.unit
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  const columnWidths = [
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 }
  ];
  ws['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Messdaten');
  XLSX.writeFile(wb, 'messdaten.xlsx');
};

export const exportMeasurementsToWord = (
  measurements: Measurement[],
  screenshots: { id: string, imageDataUrl: string, description: string }[] = []
): void => {
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
      
      <h2>Messdaten</h2>
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
    htmlContent += `<h2>Aufnahmen</h2>`;
    
    screenshots.forEach((screenshot, index) => {
      htmlContent += `
        <div class="screenshot">
          <h3>Aufnahme ${index + 1}${screenshot.description ? ': ' + screenshot.description : ''}</h3>
          <img src="${screenshot.imageDataUrl}" alt="Aufnahme ${index + 1}">
        </div>
      `;
    });
  }
  
  htmlContent += `
    </body>
    </html>
  `;
  
  const blob = new Blob([htmlContent], { type: 'text/html' });
  saveAs(blob, 'drohnenvermessung.html');
};

export const exportMeasurementsToPDF = async (
  measurements: Measurement[] = [], 
  screenshots: { id: string, imageDataUrl: string, description: string, filename?: string }[] = []
): Promise<void> => {
  try {
    if (!measurements.length && !screenshots.length) {
      throw new Error("Keine Messdaten oder Aufnahmen vorhanden");
    }
    
    const doc = new JsPDFModule({
      compress: true
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    
    const addPageHeader = () => {
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
      }
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Drohnenvermessung', margin + 20, margin + 10);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const date = new Date().toLocaleDateString('de-DE');
      doc.text(`Datum: ${date}`, pageWidth - margin - 40, margin + 10);
      
      doc.setLineWidth(0.3);
      doc.line(margin, margin + 20, pageWidth - margin, margin + 20);
    };
    
    const addPageFooter = (pageNumber: number) => {
      const totalPages = doc.getNumberOfPages();
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);
      
      const footerText = 'Kostenloser Service von Drohnenvermessung by RooferGaming® - Weitere Informationen erhalten sie unter drohnenvermessung-roofergaming.de';
      
      doc.text(
        `Seite ${pageNumber} von ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      
      doc.setLineWidth(0.1);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.text(footerText, pageWidth / 2, pageHeight - 20, { 
        align: 'center',
        maxWidth: pageWidth - (margin * 4)
      });
    };
    
    addPageHeader();
    
    let yPos = margin + 30;
    
    if (measurements.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Messdaten', margin, yPos);
      yPos += 10;
      
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
          fontSize: 10,
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
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }
    
    if (screenshots && screenshots.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Aufnahmen', margin, yPos);
      yPos += 10;
      
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        
        try {
          const optimizedDataUrl = await optimizeImageData(
            screenshot.imageDataUrl, 
            600, // Reduced from 800 to ensure it fits better on mobile
            0.7, // Slightly reduced quality for better compression
            200  // Reduced DPI for better fit
          );
          
          const img = new Image();
          img.src = optimizedDataUrl;
          
          await new Promise<void>((resolve) => {
            img.onload = () => {
              const titleHeight = 8;
              const aspectRatio = img.width / img.height;
              // Calculate a safer image width with more margin space
              const imgWidth = contentWidth * 0.85; // Reduced from 0.95 to 0.85
              const imgHeight = imgWidth / aspectRatio;
              const requiredSpace = titleHeight + imgHeight + 25; // Added more buffer space
            
              // Make sure we always start a new page if less than 40px is available
              if (yPos + requiredSpace > pageHeight - 40) {
                doc.addPage();
                addPageHeader();
                yPos = margin + 30;
              }
              
              doc.setFontSize(11);
              doc.setFont('helvetica', 'bold');
              
              const title = screenshot.filename || `Aufnahme ${i + 1}`;
              const displayTitle = screenshot.description 
                ? `${title}: ${screenshot.description}` 
                : title;
                
              doc.text(displayTitle, margin, yPos);
              yPos += titleHeight;
              
              try {
                doc.addImage(
                  optimizedDataUrl,
                  'JPEG',
                  margin + ((contentWidth - imgWidth) / 2), // Center the image
                  yPos,
                  imgWidth,
                  imgHeight,
                  undefined,
                  'MEDIUM',
                  0
                );
                
                yPos += imgHeight + 25; // Added more space after images
              } catch (addImageError) {
                console.warn(`Aufnahme ${i + 1} konnte nicht hinzugefügt werden:`, addImageError);
                yPos += 5;
              }
              
              resolve();
            };
            
            img.onerror = () => {
              console.warn(`Aufnahme ${i + 1} konnte nicht geladen werden`);
              resolve();
            };
          });
        } catch (imgError) {
          console.warn(`Aufnahme ${i + 1} konnte nicht verarbeitet werden:`, imgError);
          yPos += 5;
        }
      }
    }
    
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i);
    }
    
    doc.save('drohnenvermessung.pdf');
  } catch (error) {
    console.error("Fehler beim Exportieren als PDF:", error);
    throw error;
  }
};
