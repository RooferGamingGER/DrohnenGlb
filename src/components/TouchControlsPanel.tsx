
import React, { useEffect, useState } from 'react';
import { Move, RotateCw, ZoomIn, ZoomOut, Maximize, Camera, RefreshCw, FileDown } from 'lucide-react';

interface TouchControlsPanelProps {
  activeMode: 'none' | 'pan' | 'rotate' | 'zoom';
  onModeChange: (mode: 'none' | 'pan' | 'rotate' | 'zoom') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onTakeScreenshot?: () => void;
  onNewProject?: () => void;
  onExportMeasurements?: () => void;
}

const TouchControlsPanel: React.FC<TouchControlsPanelProps> = ({ 
  activeMode, 
  onModeChange,
  onZoomIn,
  onZoomOut,
  onReset,
  onTakeScreenshot,
  onNewProject,
  onExportMeasurements
}) => {
  const [showExtendedControls, setShowExtendedControls] = useState(false);
  
  console.log("TouchControlsPanel rendered with activeMode:", activeMode);

  const handleButtonClick = (mode: 'none' | 'pan' | 'rotate' | 'zoom') => {
    console.log(`Button clicked: ${mode}`);
    
    // If clicking the same button again (except zoom), turn it off
    if (mode === activeMode && mode !== 'zoom') {
      console.log("Setting mode to none");
      onModeChange('none');
    } else {
      console.log(`Setting mode to ${mode}`);
      onModeChange(mode);
    }
  };

  const toggleExtendedControls = () => {
    setShowExtendedControls(prev => !prev);
  };

  // Enable Hammer.js or similar touch gesture library if available in the window object
  useEffect(() => {
    // This is a check that would help if we were to add Hammer.js in the future
    // Currently serves as a placeholder for future enhancement
    const touchSupported = 'ontouchstart' in window;
    console.log("Touch support detected:", touchSupported);
    
    // We'll rely on the native touch events in the ModelViewer component for now
  }, []);

  return (
    <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-2 z-50">
      {showExtendedControls && (
        <div className="extended-controls bg-white/90 dark:bg-black/90 rounded-full px-4 py-2 flex gap-4 shadow-lg backdrop-blur mb-2">
          {onTakeScreenshot && (
            <button
              type="button"
              className="touch-control-button p-2 rounded-full bg-muted hover:bg-muted/80"
              onClick={onTakeScreenshot}
              aria-label="Screenshot erstellen"
            >
              <Camera size={24} />
            </button>
          )}
          
          {onNewProject && (
            <button
              type="button"
              className="touch-control-button p-2 rounded-full bg-muted hover:bg-muted/80"
              onClick={onNewProject}
              aria-label="Neu laden"
            >
              <RefreshCw size={24} />
            </button>
          )}
          
          {onExportMeasurements && (
            <button
              type="button"
              className="touch-control-button p-2 rounded-full bg-muted hover:bg-muted/80"
              onClick={onExportMeasurements}
              aria-label="Speichern"
            >
              <FileDown size={24} />
            </button>
          )}
        </div>
      )}
      
      <div className="touch-controls-panel bg-white/90 dark:bg-black/90 rounded-full px-4 py-2 flex gap-4 shadow-lg backdrop-blur">
        <button
          type="button"
          className={`touch-control-button p-2 rounded-full ${activeMode === 'pan' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          onClick={() => handleButtonClick('pan')}
          aria-label="Verschieben"
        >
          <Move size={24} />
        </button>
        
        <button
          type="button"
          className={`touch-control-button p-2 rounded-full ${activeMode === 'rotate' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
          onClick={() => handleButtonClick('rotate')}
          aria-label="Drehen"
        >
          <RotateCw size={24} />
        </button>
        
        <button
          type="button"
          className="touch-control-button p-2 rounded-full bg-muted hover:bg-muted/80"
          onClick={onZoomIn}
          aria-label="Heranzoomen"
        >
          <ZoomIn size={24} />
        </button>
        
        <button
          type="button"
          className="touch-control-button p-2 rounded-full bg-muted hover:bg-muted/80"
          onClick={onZoomOut}
          aria-label="Herauszoomen"
        >
          <ZoomOut size={24} />
        </button>
        
        <button
          type="button"
          className="touch-control-button p-2 rounded-full bg-muted hover:bg-muted/80"
          onClick={onReset}
          aria-label="Ansicht zurücksetzen"
        >
          <Maximize size={24} />
        </button>
        
        {(onTakeScreenshot || onNewProject || onExportMeasurements) && (
          <button
            type="button"
            className={`touch-control-button p-2 rounded-full ${showExtendedControls ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            onClick={toggleExtendedControls}
            aria-label="Weitere Optionen"
          >
            {/* Three dots for more options */}
            <div className="flex flex-col items-center justify-center h-6 w-6">
              <div className="bg-current rounded-full h-1 w-1 mb-0.5"></div>
              <div className="bg-current rounded-full h-1 w-1 mb-0.5"></div>
              <div className="bg-current rounded-full h-1 w-1"></div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

export default TouchControlsPanel;
