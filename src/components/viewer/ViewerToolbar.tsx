
import ViewerControls from '@/components/ViewerControls';

interface ViewerToolbarProps {
  isFullscreen: boolean;
  loadedModel: boolean;
  showMeasurementTools: boolean;
  onReset: () => void;
  onFullscreen: () => void;
  toggleMeasurementTools: () => void;
  onNewProject: () => void;
  onTakeScreenshot: () => void;
  onExportMeasurements: () => void;
  isMobile: boolean;
}

const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
  isFullscreen,
  loadedModel,
  showMeasurementTools,
  onReset,
  onFullscreen,
  toggleMeasurementTools,
  onNewProject,
  onTakeScreenshot,
  onExportMeasurements,
  isMobile
}) => {
  return (
    <div className={`flex items-center justify-between w-full p-2 lg:p-4 bg-background/80 backdrop-blur-sm z-10 ${isFullscreen ? 'fixed top-0 left-0 right-0' : ''}`}>
      <div>
        {loadedModel && showMeasurementTools && isMobile && (
          <button
            className="bg-background/70 backdrop-blur-sm flex items-center gap-1 px-3 py-2 rounded-md text-sm"
            onClick={toggleMeasurementTools}
          >
            <span className="sr-only">Messwerkzeuge schließen</span>
            ✕ Messwerkzeuge
          </button>
        )}
      </div>
      
      <ViewerControls
        onReset={onReset}
        onFullscreen={onFullscreen}
        isFullscreen={isFullscreen}
        showMeasurementTools={showMeasurementTools}
        toggleMeasurementTools={toggleMeasurementTools}
        showUpload={loadedModel}
        onNewProject={onNewProject}
        onScreenshot={onTakeScreenshot}
        onExportMeasurements={onExportMeasurements}
      />
    </div>
  );
};

export default ViewerToolbar;
