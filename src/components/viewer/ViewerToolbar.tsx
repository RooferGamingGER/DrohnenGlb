
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
  
  // Create toolbar component with dynamic positioning based on fullscreen status
  const toolbarClassName = `flex items-center justify-between w-full p-2 lg:p-4 bg-background/80 backdrop-blur-sm z-10 ${
    isFullscreen ? 'fixed top-0 left-0 right-0' : ''
  }`;
  
  return (
    <div className={toolbarClassName}>
      <div>
        {/* Empty left section - could be used for logo or branding in the future */}
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
