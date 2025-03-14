
import MeasurementTools from '@/components/MeasurementTools';
import { Measurement, MeasurementType, MeasurementPoint } from '@/utils/measurementUtils';
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileDown, Home, RefreshCcw, Camera } from "lucide-react";
import { toast } from '@/hooks/use-toast';
import { exportMeasurementsToPDF } from '@/utils/screenshotUtils';
import { ScrollArea } from "@/components/ui/scroll-area";

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
  screenshots: { id: string, imageDataUrl: string, description: string }[];
  isMobile: boolean;
  isFullscreen: boolean;
  onNewProject: () => void;
  onTakeScreenshot: () => void;
  tempPoints: MeasurementPoint[];
  onDeleteTempPoint: (index: number) => void;
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
  screenshots,
  isMobile,
  isFullscreen,
  onNewProject,
  onTakeScreenshot,
  tempPoints,
  onDeleteTempPoint
}) => {
  const totalArea = measurements
    .filter(m => m.type === 'area' && m.value && m.visible)
    .reduce((sum, m) => sum + m.value, 0);
  
  const totalAreaCount = measurements
    .filter(m => m.type === 'area' && m.visible)
    .length;

  const handleDeleteTempPoint = (index: number) => {
    console.log("Attempting to delete temp point at index:", index);
    if (onDeleteTempPoint) {
      onDeleteTempPoint(index);
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

  // Mobile view in portrait mode
  if (isMobile && isFullscreen) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white p-2 border-t border-zinc-200">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center sticky top-0 bg-white">
            <span className="font-bold">Zusammenfassung</span>
            <div className="flex space-x-2">
              <span>Gesamte Fläche: {totalArea.toFixed(2)} m²</span>
              <span>Anzahl: {totalAreaCount}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onTakeScreenshot}
              className="text-xs py-1 h-auto"
            >
              <Camera className="mr-1 h-3 w-3" />
              Screenshot
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onNewProject}
              className="text-xs py-1 h-auto"
            >
              <RefreshCcw className="mr-1 h-3 w-3" />
              Neu laden
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/'}
              className="text-xs py-1 h-auto"
            >
              <Home className="mr-1 h-3 w-3" />
              Zurück
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadReport}
              className="text-xs py-1 h-auto ml-auto"
            >
              <FileDown className="mr-1 h-3 w-3" />
              Speichern
            </Button>
          </div>
          
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
            screenshots={screenshots}
            isMobile={isMobile}
            scrollThreshold={3}
            tempPoints={tempPoints}
            onDeleteTempPoint={handleDeleteTempPoint}
          />
        </div>
      </div>
    );
  }

  // Desktop view
  return (
    <SidebarProvider>
      <Sidebar className="z-20 fixed top-0 left-0 bottom-0 w-64 bg-white text-zinc-900 border-r border-zinc-200">
        <SidebarHeader className="p-4 border-b border-zinc-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold">Zusammenfassung</h2>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between">
              <span>Gesamte Fläche:</span>
              <span>{totalArea.toFixed(2)} m²</span>
            </div>
            <div className="flex justify-between">
              <span>Anzahl der Flächen:</span>
              <span>{totalAreaCount}</span>
            </div>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-4">
          <div className="flex flex-col space-y-3 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onTakeScreenshot}
              className="w-full justify-start"
            >
              <Camera className="mr-2 h-4 w-4" />
              Screenshot anfertigen
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onNewProject}
              className="w-full justify-start"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Projekt neu laden
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/'}
              className="w-full justify-start"
            >
              <Home className="mr-2 h-4 w-4" />
              Zurück zur Hauptseite
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-380px)]">
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
              screenshots={screenshots}
              isMobile={isMobile}
              scrollThreshold={5}
              tempPoints={tempPoints}
              onDeleteTempPoint={handleDeleteTempPoint}
            />
          </ScrollArea>
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
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
};

export default MeasurementToolsPanel;
