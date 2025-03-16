
import { saveAs } from 'file-saver';
import { Measurement, isInclinationSignificant } from '../measurementUtils';
import { Screenshot } from './types';

/**
 * Exports measurements to Word-compatible HTML format
 */
export const exportMeasurementsToWord = (
  measurements: Measurement[],
  screenshots: Screenshot[] = []
): void => {
  // Exit early if no data to export
  if (measurements.length === 0 && (!screenshots || screenshots.length === 0)) {
    throw new Error("Keine Daten zum Exportieren vorhanden");
  }

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
  `;
  
  if (measurements.length > 0) {
    htmlContent += `
      <h2>Messdaten</h2>
      <table>
        <thead>
          <tr>
            <th>Beschreibung</th>
            <th>Typ</th>
            <th>Messwert</th>
            <th>Dachneigung</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    measurements.forEach(m => {
      const hasSignificantInclination = m.type === 'length' && 
                                       m.inclination !== undefined && 
                                       isInclinationSignificant(m.inclination);
      
      htmlContent += `
        <tr>
          <td>${m.description || '-'}</td>
          <td>${m.type === 'length' ? 'Länge' : 'Höhe'}</td>
          <td>${m.value.toFixed(2)} ${m.unit}</td>
          <td>${hasSignificantInclination ? `${m.inclination?.toFixed(1)}°` : '-'}</td>
        </tr>
      `;
    });
    
    htmlContent += `
        </tbody>
      </table>
    `;
  }
  
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
