import { useRef, useState, useEffect, useCallback } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  captureScreenshot, 
  exportMeasurementsToPDF, 
  exportMeasurementsToWord 
} from '@/utils/screenshotUtils';

// Refactored components
import ViewerToolbar from '@/components/viewer/ViewerToolbar';
import ViewerContainer from '@/components/viewer/ViewerContainer';
import LoadingOverlay from '@/components/viewer/LoadingOverlay';
import DropZone from '@/components/viewer/DropZone';
import MeasurementToolsPanel from '@/components/viewer/MeasurementToolsPanel';
import ScreenshotDialog from '@/components/ScreenshotDialog';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isMobile } = useIsMobile();
  const [showMeasurementTools, setShowMeasurementTools] = useState(false);
  const [measurementsVisible, setMeasurementsVisible] = useState(true);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [savedScreenshots, setSavedScreenshots] = useState<{id: string, imageDataUrl: string, description: string}[]>([]);
  
  const modelViewer = useModelViewer({
    containerRef,
    onLoadComplete: () => {
      setTimeout(() => {
        modelViewer.setProgress(100);
      }, 500);
    }
  });
  
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  const handleFileSelected = useCallback(async (file: File) => {
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
  }, [modelViewer, toast]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    handleFileSelected(files[0]);
  }, [handleFileSelected]);

  const handleResetView = useCallback(() => {
    modelViewer.resetView();
  }, [modelViewer]);

  const handleToolChange = useCallback((tool: any) => {
    modelViewer.setActiveTool(tool);
  }, [modelViewer]);

  const handleNewProject = useCallback(() => {
    if (modelViewer.loadedModel) {
      modelViewer.resetView();
      modelViewer.clearMeasurements();
      setShowMeasurementTools(false);
      setSavedScreenshots([]);
      
      if (containerRef.current) {
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
      }
      
      modelViewer.initScene();
    }
  }, [modelViewer]);

  const handleTakeScreenshot = useCallback(() => {
    const isPortrait = window.innerHeight > window.innerWidth;
    
    if (isMobile && isPortrait) {
      toast({
        title: "Portrait-Modus erkannt",
        description: "Screenshots können nur im Querformat erstellt werden. Bitte drehen Sie Ihr Gerät.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    
    if (modelViewer.renderer && modelViewer.scene && modelViewer.camera) {
      const dataUrl = captureScreenshot(
        modelViewer.renderer,
        modelViewer.scene,
        modelViewer.camera,
        isMobile
      );
      
      if (dataUrl) {
        setScreenshotData(dataUrl);
        setShowScreenshotDialog(true);
      }
    } else {
      toast({
        title: "Fehler",
        description: "Screenshot konnte nicht erstellt werden.",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [isMobile, modelViewer, toast]);

  const handleSaveScreenshot = useCallback((imageDataUrl: string, description: string) => {
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
  }, [toast]);

  const handleExportMeasurements = useCallback(async () => {
    if (modelViewer.measurements.length === 0 && savedScreenshots.length === 0) {
      toast({
        title: "Keine Daten vorhanden",
        description: "Es sind weder Messungen noch Screenshots zum Exportieren vorhanden.",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "Export wird vorbereitet",
        description: "Bitte warten Sie, während der Export vorbereitet wird...",
      });
      
      try {
        await exportMeasurementsToPDF(modelViewer.measurements, savedScreenshots);
        toast({
          title: "Export erfolgreich",
          description: "Die Daten wurden als PDF-Datei exportiert.",
        });
      } catch (pdfError) {
        console.error('Error exporting to PDF:', pdfError);
        
        exportMeasurementsToWord(modelViewer.measurements, savedScreenshots);
        toast({
          title: "Export als Fallback erfolgreich",
          description: "PDF-Export fehlgeschlagen. Die Daten wurden als HTML-Datei exportiert (in Word öffnen).",
        });
      }
    } catch (error) {
      console.error('Error exporting measurements:', error);
      toast({
        title: "Fehler beim Export",
        description: "Die Daten konnten nicht exportiert werden.",
        variant: "destructive"
      });
    }
  }, [modelViewer.measurements, savedScreenshots, toast]);

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
          "Messungen wurden wieder eingeblendet.",
        duration: 5000,
      });
    }
  }, [measurementsVisible, modelViewer, toast]);

  const toggleSingleMeasurementVisibility = useCallback((id: string) => {
    const measurement = modelViewer.measurements.find(m => m.id === id);
    if (measurement) {
      const newVisibility = !measurement.visible;
      modelViewer.updateMeasurement(id, { visible: newVisibility });
      
      toast({
        title: newVisibility ? "Messung eingeblendet" : "Messung ausgeblendet",
        description: `Die Messung wurde ${newVisibility ? 'ein' : 'aus'}geblendet.`,
        duration: 5000,
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
      <ViewerToolbar 
        isFullscreen={isFullscreen}
        loadedModel={!!modelViewer.loadedModel}
        showMeasurementTools={showMeasurementTools}
        onReset={handleResetView}
        onFullscreen={toggleFullscreen}
        toggleMeasurementTools={toggleMeasurementTools}
        onNewProject={handleNewProject}
        onTakeScreenshot={handleTakeScreenshot}
        onExportMeasurements={handleExportMeasurements}
        isMobile={isMobile}
      />
      
      <ViewerContainer
        ref={containerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {modelViewer.isLoading && (
          <LoadingOverlay progress={modelViewer.progress} />
        )}
        
        {!modelViewer.loadedModel && !modelViewer.isLoading && (
          <DropZone 
            onFileSelected={handleFileSelected}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        )}
      </ViewerContainer>
      
      {modelViewer.loadedModel && showMeasurementTools && (
        <MeasurementToolsPanel
          measurements={modelViewer.measurements}
          activeTool={modelViewer.activeTool}
          onToolChange={handleToolChange}
          onClearMeasurements={modelViewer.clearMeasurements}
          onDeleteMeasurement={modelViewer.deleteMeasurement}
          onUndoLastPoint={modelViewer.undoLastPoint}
          onUpdateMeasurement={modelViewer.updateMeasurement}
          onToggleMeasurementVisibility={toggleSingleMeasurementVisibility}
          onToggleAllMeasurementsVisibility={toggleMeasurementsVisibility}
          allMeasurementsVisible={measurementsVisible}
          canUndo={modelViewer.canUndo}
          onClose={toggleMeasurementTools}
          screenshots={savedScreenshots}
          isMobile={isMobile}
          isFullscreen={isFullscreen}
        />
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
