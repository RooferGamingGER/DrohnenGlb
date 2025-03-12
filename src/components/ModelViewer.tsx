import { useState, useRef, useEffect, useCallback } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileUp } from 'lucide-react';
import { MeasurementType } from '@/utils/measurementUtils';
import MeasurementTools from '@/components/MeasurementTools';
import ViewerControls from '@/components/ViewerControls';
import { useToast } from '@/hooks/use-toast';

const ModelViewer = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const [showMeasurementTools, setShowMeasurementTools] = useState(false);
  
  const modelViewer = useModelViewer({
    containerRef,
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
        variant: "destructive",
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
        variant: "destructive",
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
  
  const handleToolChange = (tool: MeasurementType) => {
    modelViewer.setActiveTool(tool);
  };
  
  const toggleMeasurementTools = useCallback(() => {
    setShowMeasurementTools(prev => !prev);
  }, []);
  
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
      <div className="flex items-center justify-between w-full p-2 lg:p-4 bg-background/80 backdrop-blur-sm z-10">
        <div className="flex items-center">
          <img src="/logo.svg" alt="Logo" className="h-8 w-8 mr-2" />
          <h1 className="text-lg font-semibold">DrohnenGLB</h1>
        </div>
        <ViewerControls
          onReset={handleResetView}
          onFullscreen={handleFullscreen}
          showMeasurementTools={showMeasurementTools}
          toggleMeasurementTools={toggleMeasurementTools}
          showUpload={!!modelViewer.loadedModel}
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
                {modelViewer.progress < 70 
                  ? "Datei wird hochgeladen..." 
                  : "Modell wird verarbeitet..."}
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
      </div>
      
      {showMeasurementTools && (
        <MeasurementTools
          activeTool={modelViewer.activeTool}
          onToolChange={handleToolChange}
          onClearMeasurements={modelViewer.clearMeasurements}
          onDeleteMeasurement={modelViewer.deleteMeasurement}
          onUndoLastPoint={modelViewer.undoLastPoint}
          onUpdateMeasurement={modelViewer.updateMeasurement}
          measurements={modelViewer.measurements}
          canUndo={modelViewer.canUndo}
          onClose={toggleMeasurementTools}
        />
      )}
      
      {modelViewer.error && (
        <div className="absolute bottom-4 left-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-md">
          <p>{modelViewer.error}</p>
        </div>
      )}
    </div>
  );
};

export default ModelViewer;
