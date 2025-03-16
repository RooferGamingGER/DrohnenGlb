import MeasurementTools from '@/components/MeasurementTools';
import { Measurement, MeasurementType, MeasurementPoint, calculatePolygonArea, clearPreviewObjects } from '@/utils/measurementUtils';
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileDown, Home, RefreshCcw, Camera, Trash2, Square } from "lucide-react";
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
  onDeleteSinglePoint: (measurementId: string, pointIndex: number) => void;
  onClosePolygon: () => void;
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
  onDeleteTempPoint,
  onDeleteSinglePoint,
  onClosePolygon
}) => {
  console.log("MeasurementToolsPanel props:", {
    activeTool,
    tempPointsLength: tempPoints?.length,
    hasClosePolygonHandler: !!onClosePolygon,
    measurements: measurements.map(m => ({
      id: m.id,
      type: m.type,
      value: m.value,
      points: m.points.length
    }))
  });

  const totalLength = measurements
    .filter(m => m.type === 'length' && m.value && m.visible)
    .reduce((sum, m) => sum + m.value, 0);
  
  const totalLengthCount = measurements
    .filter(m => m.type === 'length' && m.visible)
    .length;
    
  const totalArea = measurements
    .filter(m => m.type === 'area' && m.value && m.visible)
    .reduce((sum, m) => sum + m.value, 0);
  
  const totalAreaCount = measurements
    .filter(m => m.type === 'area' && m.visible)
    .length;

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

  // Real-time area calculation for in-progress polygon
  const tempArea = tempPoints && tempPoints.length >= 3 
    ? calculatePolygonArea([...tempPoints.map(p => p.position), tempPoints[0].position])
    : 0;

  const canClosePolygon = activeTool === 'area' && tempPoints && tempPoints.length >= 3;

  const handleClosePolygon = () => {
    if (canClosePolygon) {
      onClosePolygon();
      
      // Toast notification will be shown by ModelViewer after actual completion
      // so we won't add a duplicate notification here
    } else {
      toast({
        title: "Nicht genügend Punkte",
        description: "Es werden mindestens 3 Punkte benötigt, um eine Fläche zu schließen.",
        variant: "destructive",
      });
    }
  };

  if (isMobile && window.innerHeight > window.innerWidth) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white p-2 border-t border-zinc-200">
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center sticky top-0 bg-white">
            <div className="flex space-x-2">
            {canClosePolygon && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClosePolygon}
                className="text-xs py-1 h-auto border-blue-500 text-blue-500 hover:bg-blue-50 font-bold animate-pulse transition-all duration-300"
              >
                <Square className="mr-1 h-3 w-3" />
                Fläche schließen
                {tempArea > 0 && <span className="ml-1 opacity-75">({tempArea < 0.01 ? `${(tempArea * 10000).toFixed(2)} cm²` : `${tempArea.toFixed(2)} m²`})</span>}
              </Button>
            )}
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
            onDeleteTempPoint={onDeleteTempPoint}
            onDeleteSinglePoint={onDeleteSinglePoint}
            onClosePolygon={onClosePolygon}
          />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar className="z-20 fixed top-0 left-0 bottom-0 w-64 bg-white text-zinc-900 border-r border-zinc-200">
        <SidebarHeader className="p-4 border-b border-zinc-200 sticky top-0 bg-white">
          {canClosePolygon && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClosePolygon}
              className="w-full mb-3 border-blue-500 text-blue-500 hover:bg-blue-50 font-bold animate-pulse transition-all duration-300"
            >
              <Square className="mr-2 h-4 w-4" />
              Fläche schließen
              {tempArea > 0 && <span className="ml-1 opacity-75">({tempArea < 0.01 ? `${(tempArea * 10000).toFixed(2)} cm²` : `${tempArea.toFixed(2)} m²`})</span>}
            </Button>
          )}
          
          {(totalLengthCount > 0 || totalAreaCount > 0) && (
            <div className="text-xs text-muted-foreground mb-2">
              {totalLengthCount > 0 && (
                <div className="flex justify-between mb-1">
                  <span>Gesamtlänge ({totalLengthCount}):</span>
                  <span className="font-medium">{totalLength.toFixed(2)} m</span>
                </div>
              )}
              {totalAreaCount > 0 && (
                <div className="flex justify-between">
                  <span>Gesamtfläche ({totalAreaCount}):</span>
                  <span className="font-medium">
                    {totalArea < 0.01 
                      ? `${(totalArea * 10000).toFixed(2)} cm²` 
                      : `${totalArea.toFixed(2)} m²`}
                  </span>
                </div>
              )}
            </div>
          )}
        </SidebarHeader>
        
        <SidebarContent className="p-4">
          <div className="flex flex-col space-y-3 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onTakeScreenshot}
              className="w-full justify-start"
              title="Erstellen Sie einen Screenshot des aktuellen Modells"
            >
              <Camera className="mr-2 h-4 w-4" />
              Screenshot anfertigen
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onNewProject}
              className="w-full justify-start"
              title="Laden Sie die aktuelle Ansicht neu"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Ansicht neu laden
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.location.href = '/'}
              className="w-full justify-start"
              title="Zurück zur Startseite"
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
              onDeleteTempPoint={onDeleteTempPoint}
              onDeleteSinglePoint={onDeleteSinglePoint}
              onClosePolygon={onClosePolygon}
            />
          </ScrollArea>
        </SidebarContent>
        
        <SidebarFooter className="p-4 border-t border-zinc-200 mt-auto">
          <div className="space-y-2">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={handleDownloadReport}
              title="Speichern Sie alle Messungen und Screenshots als PDF-Bericht"
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
