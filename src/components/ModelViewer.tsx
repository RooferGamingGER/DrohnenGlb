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
  calculatePolygonArea,
  closePolygon,
  updateAreaPreview,
  finalizePolygon,
  Measurement,
  clearPreviewObjects
} from '@/utils/measurementUtils';
import { 
  calculateZoomFactor, 
  calculatePanSpeedFactor,
  optimallyCenterModel 
} from '@/utils/modelUtils';

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
  const { isMobile, isTablet, isPortrait, isTouchDevice } = useIsMobile();
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
  const [modelCentered, setModelCentered] = useState(false);
  
  const [isRightMouseDown, setIsRightMouseDown] = useState(false);
  const rightMousePreviousPosition = useRef<{x: number, y: number} | null>(null);
  
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
        
        if (modelViewer.loadedModel && modelViewer.camera && modelViewer.controls) {
          console.log("Optimales Zentrieren des Modells nach vollständigem Laden");
          optimallyCenterModel(
            modelViewer.loadedModel,
            modelViewer.camera,
            modelViewer.controls
          );
          setModelCentered(true);
        }
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
      setModelCentered(false);
      await modelViewer.loadModel(file);
      setShowMeasurementTools(true);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  }, [modelViewer, toast]);

  useEffect(() => {
    if (modelViewer.loadedModel && modelViewer.camera && modelViewer.controls && !modelCentered) {
      console.log("Erstes Zentrieren nach Modellladung");
      optimallyCenterModel(
        modelViewer.loadedModel,
        modelViewer.camera,
        modelViewer.controls
      );
      setModelCentered(true);
    }
  }, [modelViewer.loadedModel, modelViewer.camera, modelViewer.controls, modelCentered]);

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
    setModelCentered(false);
    
    modelViewer.resetView();
    
    if (modelViewer.loadedModel && modelViewer.camera && modelViewer.controls) {
      console.log("Zentrieren nach Reset View wie beim ersten Laden");
      setTimeout(() => {
        optimallyCenterModel(
          modelViewer.loadedModel,
          modelViewer.camera,
          modelViewer.controls
        );
        
        const box = new THREE.Box3().setFromObject(modelViewer.loadedModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        modelSizeRef.current = Math.max(size.x, size.y, size.z);
        
        setModelCentered(true);
      }, 100);
    }
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
      setModelCentered(false);
      
      modelViewer.resetView();
      modelViewer.clearMeasurements();
      setSavedScreenshots([]);
      
      if (modelViewer.camera && modelViewer.controls) {
        console.log("Zentrieren nach New Project wie beim ersten Laden");
        setTimeout(() => {
          optimallyCenterModel(
            modelViewer.loadedModel,
            modelViewer.camera,
            modelViewer.controls
          );
          
          const box = new THREE.Box3().setFromObject(modelViewer.loadedModel);
          const size = new THREE.Vector3();
          box.getSize(size);
          modelSizeRef.current = Math.max(size.x, size.y, size.z);
          
          setModelCentered(true);
        }, 100);
      }
      
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

  const modelSizeRef = useRef<number>(0);
  
  const touchStartRef = useRef<{x1: number, y1: number, x2?: number, y2?: number, distance?: number} | null>(null);
  
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
          
          if (measurement.type === 'area' && updatedPoints.length >= 3) {
            if (selectedPointIndex === 0) {
              const lastIndex = updatedPoints.length - 1;
              const firstPoint = updatedPoints[0].position;
              const lastPoint = updatedPoints[lastIndex].position;
              
              if (lastPoint.distanceTo(firstPoint) < 0.1) {
                updatedPoints[lastIndex] = {
                  position: newPosition.clone(),
                  worldPosition: newPosition.clone()
                };
              }
            }
            
            if (selectedPointIndex === updatedPoints.length - 1) {
              const firstPoint = updatedPoints[0].position;
              const lastPoint = updatedPoints[selectedPointIndex].position;
              
              if (lastPoint.distanceTo(firstPoint) < 0.1) {
                updatedPoints[0] = {
                  position: newPosition.clone(),
                  worldPosition: newPosition.clone()
                };
              }
            }
            
            const positions = updatedPoints.map(p => p.position);
            const area = calculatePolygonArea(positions);
            measurement.value = area;
            
            updateMeasurementGeometry(measurement);
          }
          
          modelViewer.updateMeasurement(selectedMeasurementId, { 
            points: updatedPoints,
            value: measurement.value 
          });
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
    if (!modelViewer.loadedModel || !containerRef.current) return;
    
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const x1 = touch1.clientX;
      const y1 = touch1.clientY;
      const x2 = touch2.clientX;
      const y2 = touch2.clientY;
      
      const distance = Math.sqrt(
        Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
      );
      
      touchStartRef.current = { x1, y1, x2, y2, distance };
      
      if (touchMode !== 'zoom') {
        setTouchMode('zoom');
      }
      
      return;
    }
    
    touchStartRef.current = null;
    
    if (event.touches.length !== 1) return;
    
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
        modelViewer.camera!,
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
  }, [modelViewer, toast, isFollowingMouse, draggedPoint, selectedMeasurementId, selectedPointIndex, touchMode]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!modelViewer.loadedModel || !containerRef.current) return;
    
    if (event.touches.length === 2 && touchStartRef.current && 
        touchStartRef.current.x2 !== undefined && 
        touchStartRef.current.y2 !== undefined && 
        touchStartRef.current.distance !== undefined) {
      
      event.preventDefault();
      
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const x1 = touch1.clientX;
      const y1 = touch1.clientY;
      const x2 = touch2.clientX;
      const y2 = touch2.clientY;
      
      const currentDistance = Math.sqrt(
        Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
      );
      
      const initialDistance = touchStartRef.current.distance;
      const zoomRatio = currentDistance / initialDistance;
      
      if (modelViewer.camera && modelViewer.controls) {
        const zoomFactor = calculateZoomFactor(
          modelViewer.camera,
          modelViewer.controls.target,
          modelSizeRef.current
        );
        
        const direction = new THREE.Vector3();
        direction.subVectors(modelViewer.camera.position, modelViewer.controls.target).normalize();
        
        if (zoomRatio > 1.02) {
          const scaledMovement = direction.multiplyScalar(0.5 * zoomFactor);
          modelViewer.camera.position.sub(scaledMovement);
        } else if (zoomRatio < 0.98) {
          const scaledMovement = direction.multiplyScalar(0.5 * zoomFactor);
          modelViewer.camera.position.add(scaledMovement);
        }
        
        modelViewer.controls.update();
      }
      
      touchStartRef.current = { x1, y1, x2, y2, distance: currentDistance };
      return;
    }
    
    if (isFollowingMouse && draggedPoint && selectedMeasurementId && selectedPointIndex !== null) {
      if (!containerRef.current || event.touches.length !== 1) return;
      
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
    }
  }, [isFollowingMouse, draggedPoint, modelViewer, selectedMeasurementId, selectedPointIndex]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    touchStartRef.current = null;
    
    if (touchMode === 'zoom' && event.touches.length === 0) {
      setTouchMode('none');
    }
  }, [touchMode]);

  const handleTouchModeChange = useCallback((mode: 'none' | 'pan' | 'rotate' | 'zoom') => {
    console.log(`Touch mode changed to: ${mode}`);
    setTouchMode(mode);

    if (!modelViewer.controls) return;

    modelViewer.controls.enableRotate = false;
    modelViewer.controls.enablePan = false;
    modelViewer.controls.enableZoom = false;

    switch (mode) {
      case 'rotate':
        modelViewer.controls.enableRotate = true;
        break;
      case 'pan':
        modelViewer.controls.enablePan = true;
        break;
      case 'zoom':
        modelViewer.controls.enableZoom = true;
        if (mode === 'zoom' && modelViewer.camera) {
          const direction = new THREE.Vector3();
          direction.subVectors(modelViewer.camera.position, modelViewer.controls.target).normalize();
          
          const adaptiveZoomFactor = calculateZoomFactor(
            modelViewer.camera,
            modelViewer.controls.target,
            modelSizeRef.current
          );
          
          modelViewer.camera.position.sub(direction.multiplyScalar(2 * adaptiveZoomFactor));
          modelViewer.controls.update();
          
          setTimeout(() => {
            setTouchMode('none');
            
            if (!isTouchDevice) {
              modelViewer.controls.enableRotate = true;
              modelViewer.controls.enableZoom = true;
            }
            modelViewer.controls.update();
          }, 250);
        }
        break;
      case 'none':
      default:
        if (!isTouchDevice) {
          modelViewer.controls.enableRotate = true;
          modelViewer.controls.enableZoom = true;
        }
        break;
    }
    
    if (modelViewer.controls.enabled && isTouchDevice) {
      modelViewer.controls.touches = {
         ONE: THREE.TOUCH.ROTATE,
         TWO: THREE.TOUCH.DOLLY_PAN
      };
      
      if (mode === 'pan') {
        modelViewer.controls.touches.ONE = THREE.TOUCH.PAN;
      } else if (mode === 'rotate') {
        modelViewer.controls.touches.ONE = THREE.TOUCH.ROTATE;
      }
      
      if (modelViewer.loadedModel) {
        const box = new THREE.Box3().setFromObject(modelViewer.loadedModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        modelSizeRef.current = Math.max(size.x, size.y, size.z);
      }
    }
    
    modelViewer.controls.update();
  }, [modelViewer.controls, modelViewer.camera, modelViewer.loadedModel, isTouchDevice]);

  const handleClosePolygon = useCallback(() => {
    if (modelViewer.activeTool === 'area' && modelViewer.tempPoints && modelViewer.tempPoints.length >= 3) {
      console.log("Schließe Polygon mit", modelViewer.tempPoints.length, "Punkten");
      
      // Calculate the area value before finalizing
      const tempPositions = modelViewer.tempPoints.map(p => p.position);
      const calculatedArea = calculatePolygonArea([...tempPositions, tempPositions[0]]);
      
      // Close the polygon by adding the first point as the last point
      let newPoints = closePolygon([...modelViewer.tempPoints]);
      
      if (modelViewer.finalizeMeasurement) {
        // Create a finalized measurement with the calculated area value
        modelViewer.finalizeMeasurement(newPoints, {
          value: calculatedArea
        });
        
        if (modelViewer.measurements.length > 0) {
          const lastMeasurement = modelViewer.measurements[modelViewer.measurements.length - 1];
          
          if (lastMeasurement.type === 'area') {
            console.log("Aktualisiere die Flächenmessung nach dem Schließen");
            
            // Clean up preview elements
            if (modelViewer.measurementGroupRef?.current) {
              // First clear any previous preview objects
              clearPreviewObjects(lastMeasurement, modelViewer.measurementGroupRef.current);
              
              // Then finalize the polygon with proper area calculation
              finalizePolygon(lastMeasurement, modelViewer.measurementGroupRef.current);
              
              // Make sure the area value is set correctly
              if (!lastMeasurement.value || lastMeasurement.value === 0) {
                const positions = lastMeasurement.points.map(p => p.position);
                const area = calculatePolygonArea(positions);
                
                modelViewer.updateMeasurement(lastMeasurement.id, { 
                  value: area
                });
              }
              
              // Reset the active tool to stop capturing points
              modelViewer.setActiveTool('none');
              
              // Update the measurement visuals
              updateMeasurementGeometry(lastMeasurement);
              
              toast({
                title: "Fläche berechnet",
                description: `Die Flächenmessung wurde abgeschlossen: ${lastMeasurement.value < 0.01 ? 
                  `${(lastMeasurement.value * 10000).toFixed(2)} cm²` : 
                  `${lastMeasurement.value.toFixed(2)} m²`}`,
                duration: 3000,
              });
            }
          }
        }
      } else {
        modelViewer.setActiveTool('none');
        
        toast({
          title: "Fehler bei Berechnung",
          description: "Die Flächenmessung konnte nicht abgeschlossen werden.",
          variant: "destructive",
          duration: 3000,
        });
      }
    } else if (modelViewer.tempPoints && modelViewer.tempPoints.length < 3) {
      toast({
        title: "Nicht genügend Punkte
