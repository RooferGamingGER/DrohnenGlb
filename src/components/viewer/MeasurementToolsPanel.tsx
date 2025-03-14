
import MeasurementTools from '@/components/MeasurementTools';
import { Measurement, MeasurementType } from '@/utils/measurementUtils';
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { exportMeasurementsToPDF } from '@/utils/screenshotUtils';

interface MeasurementToolsPanelProps {
  measurements: Measurement[];
  activeTool: MeasurementType;
  onToolChange: (tool: MeasurementType) => void;
  onClearMeasurements: () => void;
  onDeleteMeasurement: (id: string) => void;
  onUndoLastPoint: () => void;
  onUpdateMeasurement: (id: string, data: Partial<Measurement>) => void;
  onToggleMeasurementVisibility: (id: string) => void;
  onToggleAllMeasurementsVisibility: () => void;
  onToggleEditMode: (id: string) => void;
  allMeasurementsVisible: boolean;
  canUndo: boolean;
  onClose: () => void;
  screenshots: { id: string, imageDataUrl: string, description: string }[];
  isMobile: boolean;
  isFullscreen: boolean;
}

const MeasurementToolsPanel: React.FC<MeasurementToolsPanelProps> = ({
  measurements,
  activeTool,
  onToolChange,
  onClearMeasurements,
  onDeleteMeasurement,
  onUndoLastPoint,
  onUpdateMeasurement,
  onToggleMeasurementVisibility,
  onToggleAllMeasurementsVisibility,
  onToggleEditMode,
  allMeasurementsVisible,
  canUndo,
  onClose,
  screenshots,
  isMobile,
  isFullscreen
}) => {
  const totalArea = measurements
    .filter(m => m.type === 'area' && m.value && m.visible)
    .reduce((sum, m) => sum + m.value, 0);
  
  const totalAreaCount = measurements
    .filter(m => m.type === 'area' && m.visible)
    .length;

  const handlePrintReport = async () => {
    if (measurements.length === 0 && screenshots.length === 0) {
      toast({
        title: "Keine Daten vorhanden",
        description: "Es sind keine Messungen zum Drucken vorhanden.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Show print dialog directly after creating PDF
      await exportMeasurementsToPDF(measurements, screenshots, true);
      toast({
        title: "Druckdialog geöffnet",
        description: "Der Bericht wurde als PDF erstellt und kann jetzt gedruckt werden.",
      });
    } catch (error) {
      console.error('Fehler beim Drucken:', error);
      toast({
        title: "Fehler beim Drucken",
        description: "Der Bericht konnte nicht gedruckt werden.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadReport = async () => {
    if (measurements.length === 0 && screenshots.length === 0) {
      toast({
        title: "Keine Daten vorhanden",
        description: "Es sind keine Messungen zum Herunterladen vorhanden.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Don't open print dialog, just save the file
      await exportMeasurementsToPDF(measurements, screenshots, false);
      toast({
        title: "Bericht gespeichert",
        description: "Der Bericht wurde als PDF heruntergeladen.",
      });
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      toast({
        title: "Fehler beim Speichern",
        description: "Der Bericht konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  if (isMobile && isFullscreen) {
    return (
      <div className="fixed bottom-0 left-0 right-0 px-2 pb-2 z-20">
        <MeasurementTools
          activeTool={activeTool}
          onToolChange={onToolChange}
          onClearMeasurements={onClearMeasurements}
          onDeleteMeasurement={onDeleteMeasurement}
          onUndoLastPoint={onUndoLastPoint}
          onUpdateMeasurement={onUpdateMeasurement}
          onToggleMeasurementVisibility={onToggleMeasurementVisibility}
          onToggleAllMeasurementsVisibility={onToggleAllMeasurementsVisibility}
          onToggleEditMode={onToggleEditMode}
          allMeasurementsVisible={allMeasurementsVisible}
          measurements={measurements}
          canUndo={canUndo}
          onClose={onClose}
          screenshots={screenshots}
          isMobile={isMobile}
          scrollThreshold={3}
        />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar className="z-20 fixed top-0 left-0 bottom-0 w-64 bg-white text-zinc-900 border-r border-zinc-200">
        <SidebarHeader className="p-4 border-b border-zinc-200">
          <h2 className="text-lg font-bold">Musterprojekt</h2>
        </SidebarHeader>
        
        <SidebarContent className="p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Zusammenfassung</h3>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span>Gesamte Fläche:</span>
                  <span>{totalArea.toFixed(2)} m²</span>
                </li>
                <li className="flex justify-between">
                  <span>Anzahl der Flächen:</span>
                  <span>{totalAreaCount}</span>
                </li>
              </ul>
            </div>
            
            <div className="mt-6">
              <MeasurementTools
                activeTool={activeTool}
                onToolChange={onToolChange}
                onClearMeasurements={onClearMeasurements}
                onDeleteMeasurement={onDeleteMeasurement}
                onUndoLastPoint={onUndoLastPoint}
                onUpdateMeasurement={onUpdateMeasurement}
                onToggleMeasurementVisibility={onToggleMeasurementVisibility}
                onToggleAllMeasurementsVisibility={onToggleAllMeasurementsVisibility}
                onToggleEditMode={onToggleEditMode}
                allMeasurementsVisible={allMeasurementsVisible}
                measurements={measurements}
                canUndo={canUndo}
                onClose={onClose}
                screenshots={screenshots}
                isMobile={isMobile}
                scrollThreshold={5}
              />
            </div>
          </div>
        </SidebarContent>
        
        <SidebarFooter className="p-4 border-t border-zinc-200 mt-auto">
          <div className="space-y-2">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={handleDownloadReport}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Bericht speichern
            </Button>
            <Button 
              className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900" 
              variant="outline"
              onClick={handlePrintReport}
            >
              <Printer className="mr-2 h-4 w-4" />
              Bericht drucken
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
};

export default MeasurementToolsPanel;
