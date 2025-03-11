
import { useRef, useEffect } from 'react';
import { useModelViewer } from '@/hooks/useModelViewer';
import UploadArea from './UploadArea';
import ViewerControls from './ViewerControls';
import ControlPanel from './ControlPanel';
import { AlertCircle } from 'lucide-react';

const ModelViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  
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
  };

  // Add touch instructions for mobile
  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      const instructions = document.createElement('div');
      instructions.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 glass px-4 py-2 rounded text-sm z-10 opacity-80';
      instructions.textContent = 'Zwei Finger zum Zoomen, Ein Finger zum Drehen';
      
      setTimeout(() => {
        instructions.classList.add('fade-out');
        setTimeout(() => {
          instructions.remove();
        }, 500);
      }, 5000);
      
      document.body.appendChild(instructions);
      return () => {
        instructions.remove();
      };
    }
  }, []);

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
        
        {error && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 glass p-3 rounded-lg flex items-center gap-2 z-20 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        
        {loadedModel && (
          <div className="fixed bottom-0 left-0 right-0 z-10 p-2 glass animate-slide-up bg-background/90">
            <div className="flex flex-col md:flex-row items-center gap-2 max-w-7xl mx-auto">
              <div className="w-full md:w-auto flex-1">
                <ControlPanel
                  backgroundOptions={backgroundOptions}
                  currentBackground={background}
                  onBackgroundChange={setBackground}
                />
              </div>
              
              <div className="w-full md:w-auto flex-1">
                <UploadArea 
                  onFileSelected={handleFileSelected}
                  isLoading={isLoading}
                  progress={progress}
                />
              </div>
              
              <div className="w-full md:w-auto">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelViewer;
