
import * as XLSX from 'xlsx';
import { Measurement, MeasurementType } from '../measurementUtils';

/**
 * Exports measurements to Excel format
 */
export const exportMeasurementsToPDF = (measurements: Measurement[]): void => {
  const data = measurements.map(m => {
    let type = 'Unbekannt';
    
    if (m.type === 'length') type = 'Länge';
    else if (m.type === 'height') type = 'Höhe';
    else if (m.type === 'area') type = 'Fläche';
    else if (m.type === 'distance') type = 'Distanz';
    else if (m.type === 'angle') type = 'Winkel';
    
    return {
      'Beschreibung': m.description || '-',
      'Typ': type,
      'Wert': m.value,
      'Einheit': m.unit
    };
  });

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

export const exportMeasurementsToExcel = exportMeasurementsToPDF;
