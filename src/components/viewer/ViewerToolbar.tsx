
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
    <div className={`flex items-center justify-between w-full p-2 lg:p-4 bg-background/80 backdrop-blur-sm z-10 ${isFullscreen ? (isMobile ? 'fixed top-0 left-0 right-0' : 'fixed top-0 left-0 right-0') : ''}`}>
      <div>
        {/* Remove the "X Messwerkzeuge" button in mobile view */}
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
