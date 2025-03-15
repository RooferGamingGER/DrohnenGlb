
import * as XLSX from 'xlsx';
import { Measurement } from '@/types/measurement';

/**
 * Exports measurements to Excel format
 */
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
