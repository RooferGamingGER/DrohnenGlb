
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
  forceHideHeader?: boolean;
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
  isMobile,
  forceHideHeader = false
}) => {
  // If header is forced to be hidden, don't render anything
  if (forceHideHeader) return null;
  
  return (
    <div className={`flex items-center justify-between w-full p-2 lg:p-4 bg-background/80 backdrop-blur-sm z-10 ${isFullscreen ? (isMobile ? 'fixed top-0 left-0 right-0' : 'fixed top-0 left-0 right-0') : ''}`}>
      <div>
        {/* Empty left section */}
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
