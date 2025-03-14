
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
  updateMeasurementGeometry,
  shouldCompleteAreaMeasurement,
  updateAreaMeasurementGeometry,
  isPointCloseToFirst,
  highlightFirstPointInAreaMeasurement,
  createAreaCompletionHelper
} from '@/utils/measurementUtils';

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
  
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPoint, setDraggedPoint] = useState<THREE.Mesh | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isFollowingMouse, setIsFollowingMouse] = useState(false);
  const [isNearFirstPoint, setIsNearFirstPoint] = useState(false);
  const [areaCompletionHelper, setAreaCompletionHelper] = useState<THREE.Mesh | null>(null);
  
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

  const handleCompleteAreaMeasurement = useCallback((id: string) => {
    const measurement = modelViewer.measurements.find(m => m.id === id);
    if (!measurement || measurement.type !== 'area') return;
    
    // Always mark the measurement as complete first
    modelViewer.updateMeasurement(id, { isComplete: true });
    
    if (measurement.points.length >= 3) {
      console.log('Completing area measurement with', measurement.points.length, 'points');
      
      const firstPoint = measurement.points[0].position;
      const lastPoint = measurement.points[measurement.points.length - 1].position;
      
      // If the last point is close to the first point, remove it to avoid duplicates
      if (isPointCloseToFirst(firstPoint, lastPoint, 3.0)) {
        console.log('Removing redundant last point as it\'s close to first point');
        const updatedPoints = [...measurement.points];
        updatedPoints.pop();
        modelViewer.updateMeasurement(id, { points: updatedPoints });
      }
      
      if (modelViewer.measurementGroupRef?.current) {
        updateAreaMeasurementGeometry(measurement, modelViewer.measurementGroupRef.current);
      }
      
      // Remove any area completion helper if it exists
      if (areaCompletionHelper && modelViewer.measurementGroupRef?.current) {
        modelViewer.measurementGroupRef.current.remove(areaCompletionHelper);
        setAreaCompletionHelper(null);
      }
      
      // Show success message with the calculated area
      toast({
        title: "Flächenmessung abgeschlossen",
        description: `Die Fläche beträgt ${measurement.area?.toFixed(2)} m².`,
        duration: 5000,
      });
      
      // Reset to navigation mode
      modelViewer.setActiveTool('none');
      
      // Clear the first point highlight state
      setIsNearFirstPoint(false);
    }
  }, [modelViewer, toast, areaCompletionHelper]);

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
    
    if (tool === 'area') {
      toast({
        title: "Flächenmessung gestartet",
        description: "Klicken Sie auf das Modell, um Punkte zu setzen. Um die Fläche abzuschließen, klicken Sie auf den ersten Punkt (rot) oder auf den gelben Haken-Button in der Flächenübersicht.",
        duration: 5000,
      });
    }
  }, [modelViewer, toast]);

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

    // Handle area measurement completion and first point highlighting
    if (modelViewer.activeTool === 'area' && modelViewer.measurements.length > 0) {
      const activeAreaMeasurement = modelViewer.measurements.find(
        m => m.type === 'area' && m.isActive && !m.isComplete
      );
      
      if (activeAreaMeasurement && activeAreaMeasurement.points.length >= 3) {
        const firstPoint = activeAreaMeasurement.points[0].position;
        
        raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), modelViewer.camera!);
        
        const intersects = raycasterRef.current.intersectObject(modelViewer.loadedModel!, true);
        
        if (intersects.length > 0) {
          // Check if mouse is near the first point with a very generous threshold
          const isCloseToFirst = isPointCloseToFirst(
            firstPoint,
            intersects[0].point,
            3.0
          );
          
          // Update the state to track if we're near the first point
          setIsNearFirstPoint(isCloseToFirst);
          
          if (isCloseToFirst) {
            // Set special cursor when near first point
            document.body.style.cursor = 'pointer';
            
            // Highlight the first point
            highlightFirstPointInAreaMeasurement(activeAreaMeasurement, true);
            
            // Create or update a visual helper for area completion
            if (!areaCompletionHelper && modelViewer.measurementGroupRef?.current) {
              const helper = createAreaCompletionHelper(firstPoint.clone().add(new THREE.Vector3(0, 0.1, 0)));
              modelViewer.measurementGroupRef.current.add(helper);
              setAreaCompletionHelper(helper);
            }
            
            // Auto-complete the area if very close to the first point (within 0.4 units)
            if (firstPoint.distanceTo(intersects[0].point) < 0.4) {
              console.log('Auto-completing area measurement due to proximity');
              handleCompleteAreaMeasurement(activeAreaMeasurement.id);
            }
          } else {
            // Reset cursor
            document.body.style.cursor = 'crosshair';
            
            // Remove highlight from first point
            highlightFirstPointInAreaMeasurement(activeAreaMeasurement, false);
            
            // Remove any area completion helper if it exists
            if (areaCompletionHelper && modelViewer.measurementGroupRef?.current) {
              modelViewer.measurementGroupRef.current.remove(areaCompletionHelper);
              setAreaCompletionHelper(null);
            }
          }
        }
      }
    } else {
      // Reset near first point state if not in area measurement mode
      if (isNearFirstPoint) {
        setIsNearFirstPoint(false);
      }
      
      // Remove any area completion helper when not in area measurement mode
      if (areaCompletionHelper && modelViewer.measurementGroupRef?.current) {
        modelViewer.measurementGroupRef.current.remove(areaCompletionHelper);
        setAreaCompletionHelper(null);
      }
    }
  }, [
    isFollowingMouse, draggedPoint, modelViewer, selectedMeasurementId, 
    selectedPointIndex, isDragging, handleCompleteAreaMeasurement, 
    isNearFirstPoint, areaCompletionHelper
  ]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    
    if (!modelViewer.loadedModel || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const mousePosition = new THREE.Vector2(mouseX, mouseY);
    
    // PRIORITY 1: Check for area measurement completion first
    if (modelViewer.activeTool === 'area' && modelViewer.measurements.length > 0) {
      const activeAreaMeasurement = modelViewer.measurements.find(
        m => m.type === 'area' && m.isActive && !m.isComplete
      );
      
      if (activeAreaMeasurement && activeAreaMeasurement.points.length >= 3 && modelViewer.camera) {
        const firstPoint = activeAreaMeasurement.points[0].position;
        
        raycasterRef.current.setFromCamera(mousePosition, modelViewer.camera!);
        const intersects = raycasterRef.current.intersectObject(modelViewer.loadedModel, true);
        
        if (intersects.length > 0) {
          const clickedPosition = intersects[0].point;
          
          // Use a VERY generous threshold to detect clicks near the first point (3.0 units)
          const distanceToFirst = firstPoint.distanceTo(clickedPosition);
          
          // If we're anywhere near the first point, complete the area measurement
          if (distanceToFirst < 3.0) {
            console.log('First point clicked or area near it - completing area measurement');
            handleCompleteAreaMeasurement(activeAreaMeasurement.id);
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      }
    }
    
    // PRIORITY 2: Check for editable point dragging
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
  }, [modelViewer, toast, isFollowingMouse, draggedPoint, selectedMeasurementId, selectedPointIndex, handleCompleteAreaMeasurement]);

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
    
    if (isFollowingMouse) {
      setIsFollowingMouse(false);
      setDraggedPoint(null);
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
      document.body.style.cursor = 'auto';
    }
  }, [isDragging, draggedPoint, selectedMeasurementId, selectedPointIndex, toast, isFollowingMouse]);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!modelViewer.loadedModel || !containerRef.current || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const touchY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    const touchPosition = new THREE.Vector2(touchX, touchY);
    
    // PRIORITY 1: Check for area measurement completion first (with even more generous threshold for touch)
    if (modelViewer.activeTool === 'area' && modelViewer.measurements.length > 0) {
      const activeAreaMeasurement = modelViewer.measurements.find(
        m => m.type === 'area' && m.isActive && !m.isComplete
      );
      
      if (activeAreaMeasurement && activeAreaMeasurement.points.length >= 3 && modelViewer.camera) {
        const firstPoint = activeAreaMeasurement.points[0].position;
        
        raycasterRef.current.setFromCamera(touchPosition, modelViewer.camera);
        const intersects = raycasterRef.current.intersectObject(modelViewer.loadedModel, true);
        
        if (intersects.length > 0) {
          const clickedPosition = intersects[0].point;
          
          // Use an even more generous threshold for touch interactions (3.5 units)
          const distanceToFirst = firstPoint.distanceTo(clickedPosition);
          
          if (distanceToFirst < 3.5) {
            console.log('First point touched or area near it - completing area measurement');
            handleCompleteAreaMeasurement(activeAreaMeasurement.id);
            event.preventDefault();
            return;
          }
        }
      }
    }
    
    // PRIORITY 2: Rest of touch handling logic
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
  }, [modelViewer, toast, isFollowingMouse, draggedPoint, selectedMeasurementId, selectedPointIndex, handleCompleteAreaMeasurement]);

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
    if (isFollowingMouse) {
      setIsFollowingMouse(false);
      setDraggedPoint(null);
      setSelectedMeasurementId(null);
      setSelectedPointIndex(null);
      
      toast({
        title: "Position aktualisiert",
        description: "Der Messpunkt wurde an der neuen Position abgesetzt.",
        duration: 3000,
      });
    }
  }, [isFollowingMouse, toast]);

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
      
      // Add a keyboard shortcut (Space) to complete area measurements
      if (event.key === ' ' || event.code === 'Space') {
        const activeAreaMeasurement = modelViewer.measurements.find(
          m => m.type === 'area' && m.isActive && !m.isComplete && m.points.length >= 3
        );
        
        if (activeAreaMeasurement) {
          event.preventDefault();
          handleCompleteAreaMeasurement(activeAreaMeasurement.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, isFollowingMouse, modelViewer, toast, handleCompleteAreaMeasurement]);

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
          onToggleEditMode={toggleEditMode}
          onCompleteAreaMeasurement={handleCompleteAreaMeasurement}
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
      
      {/* Display a floating information tooltip for area measurement */}
      {modelViewer.activeTool === 'area' && modelViewer.loadedModel && (
        <div className="absolute top-20 right-4 bg-black/60 text-white p-3 rounded-lg max-w-xs z-20">
          <p className="text-sm">
            <strong>Flächenmessung:</strong> Klicken Sie auf den ersten Punkt (rot) oder den 
            gelben Haken-Button, um die Messung abzuschließen. Drücken Sie die Leertaste 
            für einen schnellen Abschluss.
          </p>
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
