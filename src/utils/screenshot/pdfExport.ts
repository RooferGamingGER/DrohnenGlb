
import { jsPDF as JsPDFModule } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Measurement, isInclinationSignificant } from '../measurementUtils';
import { Screenshot } from './types';
import { optimizeImageData } from './captureUtils';

/**
 * Exports measurements and screenshots to PDF format (DIN A4)
 */
export const exportMeasurementsToPDF = async (
    measurements: Measurement[],
    screenshots: Screenshot[]
): Promise<void> => {
    try {
        if (!measurements.length && !screenshots.length) {
            throw new Error("Keine Messdaten oder Aufnahmen vorhanden");
        }

        // 🔹 PDF im DIN A4 Format (210mm x 297mm)
        const doc = new JsPDFModule({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const logoSize = 15;
        const headerHeight = margin + logoSize + 10;
        const footerHeight = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Bildgrößen für 2 Bilder pro Seite
        const imgWidth = contentWidth;
        const imgHeight = (pageHeight - headerHeight - footerHeight - 40) / 2; // Platz für 2 Bilder

        // 🔹 Kopfzeile mit Logo
        const addPageHeader = () => {
            try {
                const logoImg = new Image();
                logoImg.src = '/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png';
                doc.addImage(logoImg, 'PNG', margin, margin, logoSize, logoSize);
            } catch (logoError) {
                console.warn("Logo konnte nicht geladen werden:", logoError);
            }

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('DrohnenGLB by RooferGaming', margin + 20, margin + 10);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            const date = new Date().toLocaleDateString('de-DE');
            const dateText = `Datum: ${date}`;
            const textRightAlignX = pageWidth - margin;

            doc.text(dateText, textRightAlignX, margin + 10, { align: 'right' });

            doc.setLineWidth(0.3);
            doc.line(margin, margin + 25, pageWidth - margin, margin + 25);
        };

        // 🔹 Fußzeile
        const addPageFooter = () => {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(128, 128, 128);

            const footerLine = 'Kostenloser Service von Drohnenvermessung by RooferGaming®';

            doc.setLineWidth(0.1);
            doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

            doc.text(footerLine, pageWidth / 2, pageHeight - 10, { align: 'center' });
            
            // Reset text color after footer
            doc.setTextColor(0, 0, 0);
        };

        // 🔹 Erste Seite mit Kopfzeile
        addPageHeader();
        let yPos = headerHeight + margin;

        // 🔹 Messdaten-Tabelle
        if (measurements.length > 0) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Messdaten', margin, yPos);
            yPos += 10;

            const tableStartY = yPos;

            const tableData = measurements.map(m => {
                const measurementRow = [
                    m.description || '-',
                    m.type === 'length' ? 'Länge' : 
                    m.type === 'area' ? 'Fläche' : 'Höhe',
                    `${m.value.toFixed(2)} ${m.unit}`
                ];
                
                // Füge Dachneigung hinzu, wenn es sich um eine Längenmessung handelt und die Neigung signifikant ist
                if (m.type === 'length' && m.inclination !== undefined) {
                    if (isInclinationSignificant(m.inclination)) {
                        measurementRow.push(`${m.inclination.toFixed(1)}°`);
                    } else {
                        measurementRow.push('-');
                    }
                } else {
                    measurementRow.push('-');
                }
                
                return measurementRow;
            });

            autoTable(doc, {
                startY: tableStartY,
                head: [['Beschreibung', 'Typ', 'Messwert', 'Dachneigung']],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                didDrawPage: () => {
                    // Add header and footer on each new page
                    addPageHeader();
                    addPageFooter();
                },
                // Configure all margin properties in one place
                margin: {
                    top: headerHeight,
                    bottom: footerHeight,
                    left: margin,
                    right: margin
                }
            });

            // Update position after table
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }

        // 🔹 Screenshots auf neuen Seiten
        if (screenshots.length > 0) {
            doc.addPage();
            addPageHeader();
            addPageFooter();
            yPos = headerHeight + margin;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Aufnahmen', margin, yPos);
            yPos += 10;

            for (let i = 0; i < screenshots.length; i++) {
                const screenshot = screenshots[i];
                
                // Wenn wir 2 Bilder auf einer Seite haben, mache eine neue Seite für das nächste
                if (i > 0 && i % 2 === 0) {
                    doc.addPage();
                    addPageHeader();
                    addPageFooter();
                    yPos = headerHeight + margin;
                }

                try {
                    // Position für das aktuelle Bild
                    const currentImagePos = i % 2 === 0 ? yPos : yPos + imgHeight + 10;
                    
                    // Optimiere das Bild
                    const optimizedDataUrl = await optimizeImageData(
                        screenshot.imageDataUrl, 1200, 0.92, 300, true
                    );

                    // Titel für das Bild
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'bold');
                    
                    const title = screenshot.filename || `Aufnahme ${i + 1}`;
                    const displayTitle = screenshot.description
                        ? `${title}: ${screenshot.description}`
                        : title;
                    
                    doc.text(displayTitle, margin, currentImagePos - 5);
                    
                    // Füge das Bild hinzu
                    doc.addImage(optimizedDataUrl, 'JPEG', margin, currentImagePos, imgWidth, imgHeight);
                    
                    // Für ungerade Indices (zweites Bild auf der Seite), erhöhe yPos für die nächste Seite
                    if (i % 2 === 1) {
                        yPos = currentImagePos + imgHeight + 20;
                    }
                } catch (imgError) {
                    console.warn(`Aufnahme ${i + 1} konnte nicht verarbeitet werden:`, imgError);
                }
            }
        }

        // 🔹 Stelle sicher, dass alle Seiten Header und Footer haben
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            // Gehe zu jeder Seite und stelle sicher, dass Header und Footer vorhanden sind
            doc.setPage(i);
            addPageFooter();
        }

        // Dokument als PDF speichern
        doc.save('Bericht.pdf');
        
        // Optional: Öffne PDF im Browser zum Drucken
        // const pdfData = doc.output('bloburl');
        // window.open(pdfData, '_blank');
    } catch (error) {
        console.error("Fehler beim Exportieren als PDF:", error);
        throw error;
    }
};
