
import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useModelViewer } from '@/hooks/useModelViewer';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  captureScreenshot, 
  exportMeasurementsToPDF, 
  exportMeasurementsToWord 
} from '@/utils/screenshotUtils';
import { 
  highlightMeasurementPoints, 
  updateCursorForDraggablePoint,
  findNearestEditablePoint,
  updateMeasurementGeometry
} from '@/utils/measurementUtils';

import ViewerToolbar from '@/components/viewer/ViewerToolbar';
import ViewerContainer from '@/components/viewer/ViewerContainer';
import LoadingOverlay from '@/components/viewer/LoadingOverlay';
import DropZone from '@/components/viewer/DropZone';
import MeasurementToolsPanel from '@/components/viewer/MeasurementToolsPanel';
import ScreenshotDialog from '@/components/ScreenshotDialog';
import TouchControlsPanel from '@/components/TouchControlsPanel';

interface ModelViewerProps {
  forceHideHeader?: boolean;
  initialFile?: File;
}

const ModelViewer: React.FC<ModelViewerProps> = ({ forceHideHeader = false, initialFile = null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isMobile, isPortrait } = useIsMobile();
  const [showMeasurementTools, setShowMeasurementTools] = useState(false);
  const [measurementsVisible, setMeasurementsVisible] = useState(true);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [savedScreenshots, setSavedScreenshots] = useState<{id: string, imageDataUrl: string, description: string}[]>([]);
  
  const [touchMode, setTouchMode] = useState<'none' | 'pan' | 'rotate' | 'zoom'>('none');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState<THREE.Mesh | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isFollowingMouse, setIsFollowingMouse] = useState(false);
  
  const shouldShowHeader = useCallback(() => {
    if (forceHideHeader) return false;
    
    if (isPortrait) return !showMeasurementTools;
    
    return !showMeasurementTools;
  }, [forceHideHeader, isPortrait, showMeasurementTools]);
  
  const [showHeader, setShowHeader] = useState(shouldShowHeader());
  
  useEffect(() => {
    setShowHeader(shouldShowHeader());
  }, [shouldShowHeader, showMeasurementTools, isPortrait]);
  
  useEffect(() => {
    if (!isPortrait) {
      setShowMeasurementTools(true);
    }
  }, [isPortrait]);
  
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  
  const modelViewer = useModelViewer({
    containerRef,
    onLoadComplete: () => {
      setTimeout(() => {
        modelViewer.setProgress(100);
      }, 500);
    }
  });
  
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
  }, [initialFile]);

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
    if (tool !== 'none') {
      modelViewer.measurements.forEach(measurement => {
        if (measurement.editMode) {
          toggleEditMode(measurement.id);
        }
      });
    }
    modelViewer.setActiveTool(tool);
  }, [modelViewer]);

  const handleNewProject = useCallback(() => {
    if (modelViewer.loadedModel) {
      modelViewer.resetView();
      modelViewer.clearMeasurements();
      setSavedScreenshots([]);
      
      toast({
        title: "Ansicht zurückgesetzt",
        description: "Die Ansicht wurde zurückgesetzt und alle Messungen gelöscht.",
        duration: 3000,
      });
    }
  }, [modelViewer, toast]);

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
        duration: 3000,
      });
    }
  }, [modelViewer, toast]);

  const toggleEditMode = useCallback((id: string) => {
    const measurement = modelViewer.measurements.find(m => m.id === id);
    if (!measurement || !modelViewer.measurementGroupRef?.current) return;

    modelViewer.measurements.forEach(m => {
      if (m.id !== id && m.editMode) {
        highlightMeasurementPoints(m, modelViewer.measurementGroupRef.current!, false);
        modelViewer.updateMeasurement(m.id, { editMode: false });
      }
    });

    const newEditMode = !measurement.editMode;
    
    if (newEditMode) {
      if (modelViewer.activeTool !== 'none') {
        modelViewer.setActiveTool('none');
      }
      
      highlightMeasurementPoints(measurement, modelViewer.measurementGroupRef.current, true);
      
      toast({
        title: "Bearbeitungsmodus aktiviert",
        description: "Klicken Sie auf einen Messpunkt, um ihn zu markieren und zu verschieben. Klicken Sie erneut, um ihn abzusetzen.",
        duration: 5000,
      });
    } else {
      highlightMeasurementPoints(measurement, modelViewer.measurementGroupRef.current, false);
      
      if (isDragging || isFollowingMouse) {
        setIsDragging(false);
        setIsFollowingMouse(false);
        setDraggedPoint(null);
        setSelectedMeasurementId(null);
        setSelectedPointIndex(null);
        document.body.style.cursor = 'auto';
      }
      
      toast({
        title: "Bearbeitungsmodus deaktiviert",
        description: "Die Messung kann nicht mehr bearbeitet werden.",
        duration: 3000,
      });
    }
    
    modelViewer.updateMeasurement(id, { editMode: newEditMode });
  }, [modelViewer, toast, isDragging, isFollowingMouse]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!modelViewer.loadedModel || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const mousePosition = new THREE.Vector2(mouseX, mouseY);
    
    if (isFollowingMouse && draggedPoint && selectedMeasurementId !== null && selectedPointIndex !== null) {
      event.preventDefault();
      
      document.body.style.cursor = 'grabbing';
      
      raycasterRef.current.setFromCamera(mousePosition, modelViewer.camera!);
      
      const intersects = raycasterRef.current.intersectObject(modelViewer.loadedModel, true);
      
      if (intersects.length > 0) {
        const newPosition = intersects[0].point.clone();
        
        draggedPoint.position.copy(newPosition);
        
        const measurement = modelViewer.measurements.find(m => m.id === selectedMeasurementId);
        
        if (measurement) {
          const updatedPoints = [...measurement.points];
          updatedPoints[selectedPointIndex] = {
            position: newPosition.clone(),
            worldPosition: newPosition.clone()
          };
          
          modelViewer.updateMeasurement(selectedMeasurementId, { points: updatedPoints });
          
          updateMeasurementGeometry(measurement);
        }
      }
    } else if (!isDragging && !isFollowingMouse && modelViewer.measurementGroupRef?.current) {
      raycasterRef.current.setFromCamera(mousePosition, modelViewer.camera!);
      raycasterRef.current.params.Points = { threshold: 0.1 };
      
      const nearestPoint = findNearestEditablePoint(
        raycasterRef.current,
        modelViewer.camera!,
        mousePosition,
        modelViewer.measurementGroupRef.current,
        0.2
      );
      
      updateCursorForDraggablePoint(!!nearestPoint);
    }
  }, [isFollowingMouse, draggedPoint, modelViewer, selectedMeasurementId, selectedPointIndex, isDragging]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    
    if (!modelViewer.loadedModel || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const mousePosition = new THREE.Vector2(mouseX, mouseY);
    
    if (modelViewer.measurementGroupRef?.current) {
      raycasterRef.current.setFromCamera(mousePosition, modelViewer.camera!);
      raycasterRef.current.params.Points = { threshold: 0.1 };
      
      const nearestPoint = findNearestEditablePoint(
        raycasterRef.current,
        modelViewer.camera!,
        mousePosition,
        modelViewer.measurementGroupRef.current,
        0.2
      );
      
      if (isFollowingMouse && draggedPoint && selectedMeasurementId && selectedPointIndex !== null) {
        event.preventDefault();
        
        setIsFollowingMouse(false);
        document.body.style.cursor = 'auto';
        
        toast({
          title: "Position aktualisiert",
          description: "Der Messpunkt wurde an der neuen Position abgesetzt.",
          duration: 3000,
        });
        
        return;
      }
      
      if (nearestPoint && !isFollowingMouse) {
        event.preventDefault();
        
        const pointName = nearestPoint.name;
        const nameParts = pointName.split('-');
        
        if (nameParts.length >= 3) {
          const measurementId = nameParts[1];
          const pointIndex = parseInt(nameParts[2], 10);
          
          setIsFollowingMouse(true);
          setDraggedPoint(nearestPoint);
          setSelectedMeasurementId(measurementId);
          setSelectedPointIndex(pointIndex);
          
          document.body.style.cursor = 'grabbing';
          
          console.log(`Punkt ausgewählt: ${pointName}, Messung: ${measurementId}, Index: ${pointIndex}`);
          
          toast({
            title: "Punkt aktiviert",
            description: "Bewegen Sie die Maus und klicken Sie erneut, um den Punkt zu platzieren.",
            duration: 3000,
          });
        }
      }
    }
  }, [modelViewer, toast, isFollowingMouse, draggedPoint, selectedMeasurementId, selectedPointIndex]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (isDragging && draggedPoint) {
      setIsDragging(false);
      
      if (selectedMeasurementId && selectedPointIndex !== null) {
        console.log(`Drag-Operation beendet für Messung: ${selectedMeasurementId}, Index: ${selectedPointIndex}`);
        
        toast({
          title: "Position aktualisiert",
          description: "Der Messpunkt wurde an die neue Position verschoben.",
          duration: 3000,
        });
      }
      
      document.body.style.cursor = 'auto';
      
      setDraggedPoint(null);
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
    }
  }, [isDragging, draggedPoint, selectedMeasurementId, selectedPointIndex, toast]);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!modelViewer.loadedModel || !containerRef.current || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const touchY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    const touchPosition = new THREE.Vector2(touchX, touchY);
    
    if (modelViewer.measurementGroupRef?.current && modelViewer.camera) {
      raycasterRef.current.setFromCamera(touchPosition, modelViewer.camera);
      raycasterRef.current.params.Points = { threshold: 0.2 };
      
      const nearestPoint = findNearestEditablePoint(
        raycasterRef.current,
        modelViewer.camera,
        touchPosition,
        modelViewer.measurementGroupRef.current,
        0.3
      );
      
      if (isFollowingMouse && draggedPoint && selectedMeasurementId && selectedPointIndex !== null) {
        event.preventDefault();
        
        setIsFollowingMouse(false);
        
        toast({
          title: "Position aktualisiert",
          description: "Der Messpunkt wurde an der neuen Position abgesetzt.",
          duration: 3000,
        });
        
        return;
      }
      
      if (nearestPoint && !isFollowingMouse) {
        event.preventDefault();
        
        const pointName = nearestPoint.name;
        const nameParts = pointName.split('-');
        
        if (nameParts.length >= 3) {
          const measurementId = nameParts[1];
          const pointIndex = parseInt(nameParts[2], 10);
          
          setIsFollowingMouse(true);
          setDraggedPoint(nearestPoint);
          setSelectedMeasurementId(measurementId);
          setSelectedPointIndex(pointIndex);
          
          console.log(`Punkt per Touch ausgewählt: ${pointName}, Messung: ${measurementId}, Index: ${pointIndex}`);
          
          toast({
            title: "Punkt aktiviert",
            description: "Bewegen Sie den Finger und tippen Sie erneut, um den Punkt zu platzieren.",
            duration: 3000,
          });
        }
      }
    }
  }, [modelViewer, toast, isFollowingMouse, draggedPoint, selectedMeasurementId, selectedPointIndex]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!isFollowingMouse || !draggedPoint || !selectedMeasurementId || selectedPointIndex === null) return;
    if (!modelViewer.loadedModel || !containerRef.current || event.touches.length !== 1) return;
    
    event.preventDefault();
    
    const touch = event.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const touchY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    const touchPosition = new THREE.Vector2(touchX, touchY);
    
    if (modelViewer.camera) {
      raycasterRef.current.setFromCamera(touchPosition, modelViewer.camera);
      
      const intersects = raycasterRef.current.intersectObject(modelViewer.loadedModel, true);
      
      if (intersects.length > 0) {
        const newPosition = intersects[0].point.clone();
        
        draggedPoint.position.copy(newPosition);
        
        const measurement = modelViewer.measurements.find(m => m.id === selectedMeasurementId);
        
        if (measurement) {
          const updatedPoints = [...measurement.points];
          updatedPoints[selectedPointIndex] = {
            position: newPosition.clone(),
            worldPosition: newPosition.clone()
          };
          
          modelViewer.updateMeasurement(selectedMeasurementId, { points: updatedPoints });
          
          updateMeasurementGeometry(measurement);
        }
      }
    }
  }, [isFollowingMouse, draggedPoint, modelViewer, selectedMeasurementId, selectedPointIndex]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
  }, []);

  const handleTouchModeChange = useCallback((mode: 'none' | 'pan' | 'rotate' | 'zoom') => {
    console.log(`Touch mode changed to: ${mode}`);
    setTouchMode(mode);

    if (mode === 'zoom' && modelViewer.controls) {
      // Instead of using a non-existent zoom method, let's adjust the camera position
      const zoomSpeed = 0.5;
      const camera = modelViewer.camera;
      if (camera) {
        camera.position.z -= zoomSpeed * 2; // Move camera closer to zoom in
        if (modelViewer.controls) {
          modelViewer.controls.update();
        }
      }
      
      setTimeout(() => {
        setTouchMode('none');
      }, 250);
    }
  }, [modelViewer.controls, modelViewer.camera]);

  useEffect(() => {
    if (!modelViewer.controls) return;
    
    modelViewer.controls.enableRotate = false;
    modelViewer.controls.enablePan = false;
    modelViewer.controls.enableZoom = false;
    
    switch (touchMode) {
      case 'rotate':
        modelViewer.controls.enableRotate = true;
        break;
      case 'pan':
        modelViewer.controls.enablePan = true;
        break;
      case 'zoom':
        modelViewer.controls.enableZoom = true;
        break;
      case 'none':
      default:
        if (!isMobile) {
          modelViewer.controls.enableRotate = true;
          modelViewer.controls.enableZoom = true;
        }
        break;
    }
    
    modelViewer.controls.update();
  }, [touchMode, modelViewer.controls, isMobile]);

  useEffect(() => {
    if (isMobile && !isPortrait && modelViewer.loadedModel && !showMeasurementTools) {
      setShowMeasurementTools(true);
    }
  }, [isMobile, isPortrait, modelViewer.loadedModel, showMeasurementTools]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    handleMouseMove, 
    handleMouseDown, 
    handleMouseUp, 
    handleTouchStart, 
    handleTouchMove, 
    handleTouchEnd
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isDragging || isFollowingMouse) {
          setIsDragging(false);
          setIsFollowingMouse(false);
          setDraggedPoint(null);
          setSelectedMeasurementId(null);
          setSelectedPointIndex(null);
          document.body.style.cursor = 'auto';
          
          toast({
            title: "Bearbeitung abgebrochen",
            description: "Die Punktmanipulation wurde abgebrochen.",
            duration: 3000,
          });
        }
        
        if (modelViewer.activeTool !== 'none') {
          modelViewer.setActiveTool('none');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, isFollowingMouse, modelViewer, toast]);

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
        forceHideHeader={!showHeader}
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
        
        {isMobile && modelViewer.loadedModel && (
          <TouchControlsPanel 
            activeMode={touchMode}
            onModeChange={handleTouchModeChange}
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
          onToggleEditMode={toggleEditMode}
          allMeasurementsVisible={measurementsVisible}
          canUndo={modelViewer.canUndo}
          screenshots={savedScreenshots}
          isMobile={isMobile}
          isFullscreen={isFullscreen}
          onNewProject={handleNewProject}
          onTakeScreenshot={handleTakeScreenshot}
          tempPoints={modelViewer.tempPoints || []}
          onDeleteTempPoint={(index) => modelViewer.deleteTempPoint(index)}
          onDeleteSinglePoint={(measurementId, pointIndex) => modelViewer.deleteSinglePoint(measurementId, pointIndex)}
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
