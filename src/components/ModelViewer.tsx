
import { useRef, useState, useEffect, useCallback } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import UploadArea from './UploadArea';
import ControlPanel from './ControlPanel';
import MeasurementTools from './MeasurementTools';
import LoadingOverlay from './LoadingOverlay';
import { ChevronUp, Info, X, Download, Maximize, Minimize } from 'lucide-react';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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
  } = useModelViewer({ containerRef: viewerRef });

  // Fix infinite loop by memoizing the file selection handler
  const handleFileSelected = useCallback((file: File) => {
    setIsUploading(true);
    loadModel(file).then(() => {
      setIsUploading(false);
      setShowInstructions(true);
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

  // Memoize toggle functions to prevent re-renders
  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  const toggleModelInfo = useCallback(() => {
    setShowModelInfo(prev => !prev);
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
                <h1 className="text-3xl font-bold text-center">
                  Drohnenaufmaß by RooferGaming
                </h1>
                <p className="text-center text-muted-foreground">
                  Willkommen bei Drohnenaufmaß! Laden Sie ein 3D-Modell im GLB-Format hoch, um es zu betrachten.
                </p>
              </div>
              <UploadArea 
                onFileSelected={handleFileSelected}
                isLoading={isUploading}
                progress={progress}
              />
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
            {/* New top control bar similar to reference site */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-sm px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Drohnenaufmaß</span>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={resetView}
                  className="text-xs flex items-center gap-1 px-3 py-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <span>Ansicht zurücksetzen</span>
                </button>
                
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
            
            <div 
              className="fixed left-4 top-1/2 transform -translate-y-1/2 z-20"
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
              />
            </div>
            
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
