
import { useRef, useState } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import UploadArea from './UploadArea';
import ViewerControls from './ViewerControls';
import ControlPanel from './ControlPanel';
import LoadingOverlay from './LoadingOverlay';
import { AlertCircle, ChevronUp } from 'lucide-react';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showControls, setShowControls] = useState(false);
  
  const {
    isLoading,
    progress,
    error,
    loadedModel,
    loadModel,
    lightRotation,
    setLightRotation,
    lightIntensity,
    setLightIntensity,
    background,
    setBackground,
    backgroundOptions,
    resetView,
    resetLight,
  } = useModelViewer({ containerRef: viewerRef });

  const handleFileSelected = (file: File) => {
    loadModel(file);
    setShowInstructions(true);
  };

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="flex-1 relative overflow-hidden" ref={viewerRef}>
        {!loadedModel && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
            <div className="max-w-md w-full animate-fade-in">
              <h2 className="text-2xl font-semibold text-center mb-6">
                Drohnenaufmaß by RooferGaming
              </h2>
              <UploadArea 
                onFileSelected={handleFileSelected}
                isLoading={isLoading}
                progress={progress}
              />
            </div>
          </div>
        )}
        
        {(isLoading || showInstructions) && loadedModel && (
          <LoadingOverlay
            progress={progress}
            showInstructions={showInstructions}
            onCloseInstructions={() => setShowInstructions(false)}
          />
        )}
        
        {error && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 glass p-3 rounded-lg flex items-center gap-2 z-20 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {loadedModel && (
          <>
            <button
              onClick={() => setShowControls(!showControls)}
              className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-20 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <span className="text-sm">Steuerung</span>
              <ChevronUp className={`w-4 h-4 transition-transform ${showControls ? 'rotate-180' : ''}`} />
            </button>
            
            <div className={`fixed bottom-0 left-0 right-0 z-10 bg-background/90 backdrop-blur-sm transition-all duration-300 ease-in-out transform ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
              <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <ControlPanel
                  backgroundOptions={backgroundOptions}
                  currentBackground={background}
                  onBackgroundChange={setBackground}
                />
                
                <UploadArea 
                  onFileSelected={handleFileSelected}
                  isLoading={isLoading}
                  progress={progress}
                />
                
                <ViewerControls
                  lightRotation={lightRotation}
                  setLightRotation={setLightRotation}
                  lightIntensity={lightIntensity}
                  setLightIntensity={setLightIntensity}
                  resetView={resetView}
                  resetLight={resetLight}
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
