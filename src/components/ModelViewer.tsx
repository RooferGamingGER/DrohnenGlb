
import { useRef, useState } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import UploadArea from './UploadArea';
import ControlPanel from './ControlPanel';
import MeasurementTools from './MeasurementTools';
import LoadingOverlay from './LoadingOverlay';
import { ChevronUp, Info } from 'lucide-react';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
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
    canUndo,
  } = useModelViewer({ containerRef: viewerRef });

  const handleFileSelected = (file: File) => {
    setIsUploading(true);
    loadModel(file).then(() => {
      setIsUploading(false);
      setShowInstructions(true);
    }).catch(() => {
      setIsUploading(false);
    });
  };

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
            onCloseInstructions={() => setShowInstructions(false)}
          />
        )}
        
        {error && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 glass p-3 rounded-lg flex items-center gap-2 z-20 animate-fade-in">
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {loadedModel && (
          <>
            <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-20">
              <MeasurementTools 
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onClearMeasurements={clearMeasurements}
                onDeleteMeasurement={deleteMeasurement}
                onUndoLastPoint={undoLastPoint}
                measurements={measurements}
                canUndo={canUndo}
              />
            </div>
            
            <button
              onClick={() => setShowControls(!showControls)}
              className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <span className="text-sm">Optionen</span>
              <ChevronUp className={`w-4 h-4 transition-transform ${showControls ? 'rotate-180' : ''}`} />
            </button>
            
            <button 
              onClick={() => setShowModelInfo(!showModelInfo)} 
              className="fixed top-4 right-4 z-20 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-lg"
              aria-label="Modell-Hilfe"
            >
              <Info className="w-5 h-5 text-primary" />
            </button>
            
            {showModelInfo && (
              <div className="fixed top-16 right-4 z-20 bg-background/90 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-xs">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-sm">Modellsteuerung</h3>
                  <button 
                    onClick={() => setShowModelInfo(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• Klicken und ziehen zum Drehen des Modells</p>
                  <p>• Scrollen oder Pinch-Geste zum Zoomen</p>
                  <p>• Zwei Finger zum Verschieben</p>
                  <p>• Doppelklick zum Zurücksetzen der Ansicht</p>
                  <p>• Für Messungen: Tool auswählen und auf das Modell klicken</p>
                </div>
              </div>
            )}
            
            <div className={`fixed bottom-0 left-0 right-0 z-10 bg-background/90 backdrop-blur-sm transition-all duration-300 ease-in-out transform ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
              <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex items-center gap-4">
                  <ControlPanel
                    backgroundOptions={backgroundOptions}
                    currentBackground={background}
                    onBackgroundChange={setBackground}
                  />
                  
                  <div className="flex-shrink-0">
                    <button
                      onClick={resetView}
                      className="px-3 py-2 text-xs border border-border rounded hover:bg-secondary transition-colors"
                    >
                      Ansicht zurücksetzen
                    </button>
                  </div>
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
