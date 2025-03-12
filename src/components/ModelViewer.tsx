
import { useRef, useState, useEffect, useCallback } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileUp, EyeOff, Eye } from 'lucide-react';
import MeasurementTools from '@/components/MeasurementTools';
import ViewerControls from '@/components/ViewerControls';
import ScreenshotDialog from '@/components/ScreenshotDialog';
import { useToast } from '@/hooks/use-toast';
import { 
  captureScreenshot, 
  exportMeasurementsToPDF, 
  exportMeasurementsToWord 
} from '@/utils/screenshotUtils';
import { useIsMobile } from '@/hooks/use-mobile';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showMeasurementTools, setShowMeasurementTools] = useState(false);
  const [measurementsVisible, setMeasurementsVisible] = useState(true);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [savedScreenshots, setSavedScreenshots] = useState<{id: string, imageDataUrl: string, description: string}[]>([]);
  
  const modelViewer = useModelViewer({
    containerRef
  });
  
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.glb')) {
      toast({
        title: "Ungültiges Dateiformat",
        description: "Bitte laden Sie eine GLB-Datei hoch.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await modelViewer.loadModel(file);
      setShowMeasurementTools(true);
    } catch (error) {
      console.error('Error loading model:', error);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.glb')) {
      toast({
        title: "Ungültiges Dateiformat",
        description: "Bitte laden Sie eine GLB-Datei hoch.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await modelViewer.loadModel(file);
      setShowMeasurementTools(true);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const handleResetView = () => {
    modelViewer.resetView();
  };

  const handleFullscreen = () => {
    toggleFullscreen();
  };

  const handleToolChange = (tool: any) => {
    modelViewer.setActiveTool(tool);
  };

  const handleNewProject = () => {
    // Instead of reloading, just reset the viewer and allow a new upload
    if (modelViewer.loadedModel) {
      modelViewer.resetView();
      modelViewer.clearMeasurements();
      setShowMeasurementTools(false);
      setSavedScreenshots([]);
      
      // Clear the container to allow a new model to be uploaded
      if (containerRef.current) {
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
      }
      
      // Initialize a new Three.js scene
      modelViewer.initScene();
    }
  };

  const handleTakeScreenshot = () => {
    if (modelViewer.renderer && modelViewer.scene && modelViewer.camera) {
      // Take screenshot of the entire container instead of just the renderer
      const dataUrl = captureScreenshot(
        modelViewer.renderer,
        modelViewer.scene,
        modelViewer.camera
      );
      setScreenshotData(dataUrl);
      setShowScreenshotDialog(true);
    } else {
      toast({
        title: "Fehler",
        description: "Screenshot konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  const handleSaveScreenshot = (imageDataUrl: string, description: string) => {
    const newScreenshot = {
      id: Date.now().toString(),
      imageDataUrl,
      description
    };
    setSavedScreenshots(prev => [...prev, newScreenshot]);
    toast({
      title: "Screenshot gespeichert",
      description: "Der Screenshot wurde zur Messung hinzugefügt.",
    });
  };

  const handleExportMeasurements = async () => {
    if (modelViewer.measurements.length > 0) {
      try {
        // Show loading toast
        const loadingToast = toast({
          title: "Export wird vorbereitet",
          description: "Bitte warten Sie, während der Export vorbereitet wird...",
        });
        
        // Try PDF export first with async/await pattern
        try {
          await exportMeasurementsToPDF(modelViewer.measurements, savedScreenshots);
          toast({
            title: "Export erfolgreich",
            description: "Die Messungen wurden als PDF-Datei exportiert.",
          });
        } catch (pdfError) {
          console.error('Error exporting to PDF:', pdfError);
          
          // Fallback to Word/HTML export if PDF fails
          exportMeasurementsToWord(modelViewer.measurements, savedScreenshots);
          toast({
            title: "Export erfolgreich",
            description: "Die Messungen wurden als HTML-Datei exportiert (in Word öffnen).",
          });
        }
      } catch (error) {
        console.error('Error exporting measurements:', error);
        toast({
          title: "Fehler beim Export",
          description: "Die Messungen konnten nicht exportiert werden.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Keine Messungen",
        description: "Es sind keine Messungen zum Exportieren vorhanden.",
        variant: "destructive"
      });
    }
  };

  const toggleMeasurementTools = useCallback(() => {
    setShowMeasurementTools(prev => !prev);
  }, []);

  const toggleMeasurementsVisibility = useCallback(() => {
    setMeasurementsVisible(prev => !prev);
    
    if (modelViewer.measurementGroupRef?.current) {
      modelViewer.toggleMeasurementsVisibility(!measurementsVisible);
      
      toast({
        title: measurementsVisible ? "Messungen ausgeblendet" : "Messungen eingeblendet",
        description: measurementsVisible ? 
          "Messungen wurden für Screenshots ausgeblendet." : 
          "Messungen wurden wieder eingeblendet."
      });
    }
  }, [measurementsVisible, modelViewer]);

  const toggleSingleMeasurementVisibility = useCallback((id: string) => {
    // Find the measurement
    const measurement = modelViewer.measurements.find(m => m.id === id);
    if (measurement) {
      // Toggle the visibility
      const newVisibility = measurement.visible === false ? true : false;
      modelViewer.updateMeasurement(id, { visible: newVisibility });
      
      toast({
        title: newVisibility ? "Messung eingeblendet" : "Messung ausgeblendet",
        description: `Die Messung wurde ${newVisibility ? 'ein' : 'aus'}geblendet.`
      });
    }
  }, [modelViewer, toast]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modelViewer.activeTool !== 'none') {
        modelViewer.setActiveTool('none');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modelViewer]);

  return (
    <div className="relative h-full w-full flex flex-col">
      <div className={`flex items-center justify-between w-full p-2 lg:p-4 bg-background/80 backdrop-blur-sm z-10 ${isFullscreen ? 'fixed top-0 left-0 right-0' : ''}`}>
        {/* Added margin to make the measurement toggle button more visible */}
        <div className="mr-4">
          {modelViewer.loadedModel && showMeasurementTools && (
            <Button
              variant="secondary"
              size="sm"
              className="bg-background/70 backdrop-blur-sm"
              onClick={toggleMeasurementTools}
            >
              {showMeasurementTools ? "Messwerkzeuge ausblenden" : "Messwerkzeuge einblenden"}
            </Button>
          )}
        </div>
        
        <ViewerControls
          onReset={handleResetView}
          onFullscreen={handleFullscreen}
          isFullscreen={isFullscreen}
          showMeasurementTools={showMeasurementTools}
          toggleMeasurementTools={toggleMeasurementTools}
          showUpload={!!modelViewer.loadedModel}
          onNewProject={handleNewProject}
          onScreenshot={handleTakeScreenshot}
          onExportMeasurements={handleExportMeasurements}
        />
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {modelViewer.isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="w-64 space-y-4">
              <h3 className="text-lg font-medium text-center">
                Modell wird geladen...
              </h3>
              <Progress value={modelViewer.progress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                {modelViewer.progress < 70 ? "Datei wird hochgeladen..." : "Modell wird verarbeitet..."}
              </p>
            </div>
          </div>
        )}
        
        {!modelViewer.loadedModel && !modelViewer.isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div 
              className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">
                GLB-Datei hochladen
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
                Ziehen Sie eine GLB-Datei hierher oder klicken Sie, um eine Datei auszuwählen
              </p>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Datei auswählen
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}
        
        {/* Measurement visibility toggle button */}
        {modelViewer.loadedModel && modelViewer.measurements.length > 0 && (
          <div className="absolute top-4 left-4 z-10">
            <Button
              variant="secondary"
              size="sm"
              className="bg-background/70 backdrop-blur-sm"
              onClick={toggleMeasurementsVisibility}
            >
              {measurementsVisible ? (
                <><EyeOff size={16} className="mr-1" /> Messungen ausblenden</>
              ) : (
                <><Eye size={16} className="mr-1" /> Messungen einblenden</>
              )}
            </Button>
          </div>
        )}
      </div>
      
      {/* Always render the MeasurementTools if they are enabled, but positioning is conditional */}
      {modelViewer.loadedModel && showMeasurementTools && (
        <div 
          className={`${isMobile ? 'fixed bottom-0 left-0 right-0 px-2 pb-2' : 'absolute top-20 left-4'} z-20 ${isFullscreen ? 'fixed' : ''}`}
        >
          <MeasurementTools
            activeTool={modelViewer.activeTool}
            onToolChange={handleToolChange}
            onClearMeasurements={modelViewer.clearMeasurements}
            onDeleteMeasurement={modelViewer.deleteMeasurement}
            onUndoLastPoint={modelViewer.undoLastPoint}
            onUpdateMeasurement={modelViewer.updateMeasurement}
            onToggleMeasurementVisibility={toggleSingleMeasurementVisibility}
            measurements={modelViewer.measurements}
            canUndo={modelViewer.canUndo}
            onClose={toggleMeasurementTools}
            screenshots={savedScreenshots}
            isMobile={isMobile}
          />
        </div>
      )}
      
      {modelViewer.error && (
        <div className="absolute bottom-4 left-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-md">
          <p>{modelViewer.error}</p>
        </div>
      )}
      
      <ScreenshotDialog
        imageDataUrl={screenshotData}
        open={showScreenshotDialog}
        onClose={() => setShowScreenshotDialog(false)}
        onSave={handleSaveScreenshot}
      />
    </div>
  );
};

export default ModelViewer;
