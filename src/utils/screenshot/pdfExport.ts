import { jsPDF as JsPDFModule } from "jspdf";
import autoTable from 'jspdf-autotable';
import { Measurement } from '../measurementUtils';
import { Screenshot } from './types';
import { optimizeImageData } from './captureUtils';

/**
 * Exports measurements and screenshots to PDF format
 */
export const exportMeasurementsToPDF = async (
  measurements: Measurement=,
  screenshots: Screenshot=
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

    // Header settings
    const logoSize = 15;
    const headerHeight = margin + logoSize + 10; // Adjust as needed

    const addPageHeader = (pageNumber: number, totalPages: number) => {
      try {
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
      doc.text('DrohnenGLB by RooferGaming', margin + 20, margin + 10);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const date = new Date().toLocaleDateString('de-DE');

      // Calculate text width for proper alignment
      const dateTextWidth = doc.getTextWidth(`Datum: ${date}`);
      const pageTextWidth = doc.getTextWidth(`Seite ${pageNumber} von ${totalPages}`);

      const rightMargin = 30; // Increased right margin

      doc.text(`Datum: ${date}`, pageWidth - rightMargin - dateTextWidth, margin + 10);
      doc.text(`Seite ${pageNumber} von ${totalPages}`, pageWidth - rightMargin - pageTextWidth, margin + 20);

      doc.setLineWidth(0.3);
      doc.line(margin, margin + 20, pageWidth - margin, margin + 20);
    };

    const addPageFooter = () => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(128, 128, 128);

      const footerLine = 'Kostenloser Service von Drohnenvermessung by RooferGaming®';

      doc.setLineWidth(0.1);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      doc.text(footerLine, pageWidth / 2, pageHeight - 20, {
        align: 'center',
        maxWidth: pageWidth - (margin * 4)
      });
    };

    let totalPages = 1;

    addPageHeader(1, totalPages);

    let yPos = headerHeight + 10; // Start content below the header

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
            1200,
            0.92,
            300,
            true
          );

          const img = new Image();
          img.src = optimizedDataUrl;

          await new Promise<void>((resolve) => {
            img.onload = () => {
              const titleHeight = 10;
              const aspectRatio = img.width / img.height;

              const imgWidth = contentWidth * 0.85;
              const imgHeight = imgWidth / aspectRatio;

              const requiredSpace = titleHeight + imgHeight + 50;
              const footerHeight = 25;

              if (yPos + requiredSpace > (pageHeight - footerHeight - 20)) {
                doc.addPage();
                totalPages++;
                addPageHeader(totalPages, totalPages);
                yPos = headerHeight + 10; // Reset yPos for the new page
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
                const xPos = margin + ((contentWidth - imgWidth) / 2);

                doc.addImage(
                  optimizedDataUrl,
                  'JPEG',
                  xPos,
                  yPos,
                  imgWidth,
                  imgHeight,
                  undefined,
                  'MEDIUM',
                  0
                );

                yPos += imgHeight + 45;
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

    const finalTotalPages = doc.getNumberOfPages();
    for (let i = 1; i <= finalTotalPages; i++) {
      doc.setPage(i);
      addPageFooter();
      addPageHeader(i, finalTotalPages);
    }

    doc.save('Bericht.pdf');
  } catch (error) {
    console.error("Fehler beim Exportieren als PDF:", error);
    throw error;
  }
};
