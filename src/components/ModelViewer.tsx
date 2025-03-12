
import { useRef, useState, useEffect, useCallback } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import UploadArea from './UploadArea';
import ControlPanel from './ControlPanel';
import MeasurementTools from './MeasurementTools';
import LoadingOverlay from './LoadingOverlay';
import ProjectsList from './ProjectsList';
import { ChevronUp, Info, X, Download, Maximize, Minimize, Save, FolderOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { saveProject, updateProjectMeasurements } from '@/services/projectService';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const {
    isLoading,
    progress,
    error,
    loadedModel,
    loadModel,
    background,
    setBackground,
    backgroundOptions,
    resetView,
    activeTool,
    setActiveTool,
    measurements,
    clearMeasurements,
    undoLastPoint,
    deleteMeasurement,
    updateMeasurement,
    canUndo,
    setMeasurements
  } = useModelViewer({ containerRef: viewerRef });

  // Fix infinite loop by memoizing the file selection handler
  const handleFileSelected = useCallback((file: File) => {
    setIsUploading(true);
    setLoadedFile(file);
    loadModel(file).then(() => {
      setIsUploading(false);
      setShowInstructions(true);
      setCurrentProjectId(null); // Reset project ID as this is a new upload
    }).catch(() => {
      setIsUploading(false);
    });
  }, [loadModel]);

  // Memoize event handler to prevent re-renders
  const handleToolsPanelClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ensure that any ongoing measurement is cancelled when interacting with the tools panel
    if (activeTool !== 'none') {
      setActiveTool('none');
    }
  }, [activeTool, setActiveTool]);

  // Save current project
  const handleSaveProject = useCallback(async () => {
    if (!isAuthenticated) {
      toast({
        title: "Nicht angemeldet",
        description: "Bitte melden Sie sich an, um Projekte zu speichern.",
        variant: "destructive",
      });
      return;
    }

    if (!loadedFile) {
      toast({
        title: "Kein Modell geladen",
        description: "Bitte laden Sie zuerst ein Modell hoch.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Speichern...",
      description: "Projekt wird gespeichert...",
    });

    try {
      if (currentProjectId) {
        // Update existing project
        const success = await updateProjectMeasurements(currentProjectId, measurements);
        if (success) {
          toast({
            title: "Gespeichert",
            description: "Projekt wurde erfolgreich aktualisiert.",
          });
        }
      } else {
        // Create new project
        const project = await saveProject(loadedFile, measurements);
        if (project) {
          setCurrentProjectId(project.id);
          toast({
            title: "Gespeichert",
            description: "Projekt wurde erfolgreich gespeichert.",
          });
        }
      }
    } catch (error) {
      console.error("Error saving project:", error);
      toast({
        title: "Fehler",
        description: "Beim Speichern ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  }, [isAuthenticated, loadedFile, currentProjectId, measurements, toast]);

  // Memoize toggle functions to prevent re-renders
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  const toggleModelInfo = useCallback(() => {
    setShowModelInfo(prev => !prev);
  }, []);

  const toggleProjects = useCallback(() => {
    setShowProjects(prev => !prev);
  }, []);

  const toggleMeasurements = useCallback(() => {
    setShowMeasurements(prev => !prev);
  }, []);

  const closeInstructions = useCallback(() => {
    setShowInstructions(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error(`Error attempting to exit full-screen mode: ${err.message}`);
      });
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle project selection
  const handleProjectSelected = useCallback((projectId: string, fileUrl: string, projectMeasurements: any[]) => {
    setCurrentProjectId(projectId);
    setShowProjects(false);
    
    // Load the model from URL
    setIsUploading(true);
    fetch(fileUrl)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], "project-model.glb", { type: "model/gltf-binary" });
        setLoadedFile(file);
        return loadModel(file);
      })
      .then(() => {
        setIsUploading(false);
        setShowInstructions(true);
        // Set the measurements from the project
        if (projectMeasurements && projectMeasurements.length > 0) {
          setMeasurements(projectMeasurements);
        }
      })
      .catch(error => {
        console.error("Error loading project model:", error);
        setIsUploading(false);
        toast({
          title: "Fehler",
          description: "Beim Laden des Projekts ist ein Fehler aufgetreten.",
          variant: "destructive",
        });
      });
  }, [loadModel, setMeasurements, toast]);

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div 
        className={`flex-1 relative overflow-hidden ${loadedModel ? 'bg-gray-100' : 'bg-white'}`} 
        ref={viewerRef}
      >
        {!loadedModel && !isLoading && !isUploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
            <div className="max-w-md w-full animate-fade-in space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-center">
                  Drohnenaufmaß by RooferGaming
                </h1>
                <p className="text-center text-muted-foreground">
                  Willkommen bei Drohnenaufmaß! Laden Sie ein 3D-Modell im GLB-Format hoch, um es zu betrachten.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <UploadArea 
                  onFileSelected={handleFileSelected}
                  isLoading={isUploading}
                  progress={progress}
                />
                
                {isAuthenticated && (
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2" 
                    onClick={toggleProjects}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">Projekte öffnen</span>
                    <span className="sm:hidden">Projekte</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {(isLoading || isUploading || (showInstructions && loadedModel)) && (
          <LoadingOverlay
            progress={progress}
            showInstructions={showInstructions && loadedModel && !isUploading}
            isUploading={isUploading}
            onCloseInstructions={closeInstructions}
          />
        )}
        
        {error && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 glass p-3 rounded-lg flex items-center gap-2 z-20 animate-fade-in">
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {loadedModel && (
          <>
            {/* Top control bar */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-sm px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Messwerkzeuge-Button in der mobilen Ansicht */}
                <button
                  onClick={toggleMeasurements}
                  className="sm:hidden flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-full transition-colors text-primary"
                  aria-label="Messwerkzeuge"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18"></path>
                    <path d="M7 17l4-4"></path>
                    <path d="M17 17H7"></path>
                    <path d="M17 11H7"></path>
                  </svg>
                  <span className="text-xs">Messen</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={resetView}
                  className="text-xs flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <span className="hidden sm:inline">Ansicht zurücksetzen</span>
                  <span className="sm:hidden">Reset</span>
                </button>
                
                {isAuthenticated && (
                  <button 
                    onClick={handleSaveProject}
                    className="text-xs flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Save className="w-4 h-4 text-primary" />
                    <span className="hidden sm:inline">Speichern</span>
                  </button>
                )}
                
                {isAuthenticated && (
                  <button 
                    onClick={toggleProjects}
                    className="text-xs flex items-center gap-1 px-2 py-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-primary" />
                    <span className="hidden sm:inline">Projekte</span>
                  </button>
                )}
                
                <button 
                  onClick={toggleModelInfo}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Modell-Hilfe"
                >
                  <Info className="w-4 h-4 text-primary" />
                </button>
                
                <button 
                  onClick={toggleFullscreen}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Vollbild umschalten"
                >
                  {isFullscreen ? 
                    <Minimize className="w-4 h-4 text-gray-700" /> : 
                    <Maximize className="w-4 h-4 text-gray-700" />
                  }
                </button>
              </div>
            </div>
            
            {/* Measurement Tools Panel - Hidden on Mobile unless toggled */}
            <div 
              className={`fixed left-4 top-1/2 transform -translate-y-1/2 z-20 sm:block ${showMeasurements ? 'block' : 'hidden'}`}
              onClick={handleToolsPanelClick}
              onMouseDown={handleToolsPanelClick}
              onMouseUp={handleToolsPanelClick}
            >
              <MeasurementTools 
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onClearMeasurements={clearMeasurements}
                onDeleteMeasurement={deleteMeasurement}
                onUndoLastPoint={undoLastPoint}
                onUpdateMeasurement={updateMeasurement}
                measurements={measurements}
                canUndo={canUndo}
                onClose={() => setShowMeasurements(false)}
              />
            </div>
            
            {/* Projects Panel */}
            {showProjects && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20">
                <div className="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-medium">Projekte</h3>
                    <button onClick={toggleProjects} className="text-gray-500 hover:text-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ProjectsList onSelect={handleProjectSelected} />
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={toggleControls}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white text-primary shadow-lg px-4 py-2 rounded-full hover:bg-gray-50 transition-colors flex items-center gap-2 border border-gray-200"
            >
              <span className="text-sm">Optionen</span>
              <ChevronUp className={`w-4 h-4 transition-transform ${showControls ? 'rotate-180' : ''}`} />
            </button>
            
            {showModelInfo && (
              <div className="fixed top-16 right-4 z-20 bg-white shadow-lg p-4 rounded-lg max-w-xs border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-sm">Modellsteuerung</h3>
                  <button 
                    onClick={toggleModelInfo}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 text-xs text-gray-600">
                  <p>• Klicken und ziehen zum Drehen des Modells</p>
                  <p>• Scrollen oder Pinch-Geste zum Zoomen</p>
                  <p>• Zwei Finger zum Verschieben</p>
                  <p>• Doppelklick zum Zurücksetzen der Ansicht</p>
                  <p>• Für Messungen: Tool auswählen und auf das Modell klicken</p>
                </div>
              </div>
            )}
            
            <div className={`fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 transition-all duration-300 ease-in-out transform ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
              <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex items-center gap-4">
                  <ControlPanel
                    backgroundOptions={backgroundOptions}
                    currentBackground={background}
                    onBackgroundChange={setBackground}
                  />
                </div>
                
                <UploadArea 
                  onFileSelected={handleFileSelected}
                  isLoading={isUploading}
                  progress={progress}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelViewer;
