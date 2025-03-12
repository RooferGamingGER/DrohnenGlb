
import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Maximize, 
  Minimize, 
  Ruler, 
  Camera, 
  FileText,
  Home
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface ViewerControlsProps {
  onReset: () => void;
  onFullscreen: () => void;
  onScreenshot?: () => void;
  onExportMeasurements?: () => void;
  onNewProject?: () => void;
  isFullscreen?: boolean;
  showMeasurementTools: boolean;
  toggleMeasurementTools: () => void;
  showUpload?: boolean;
}

const ViewerControls: React.FC<ViewerControlsProps> = ({
  onReset,
  onFullscreen,
  onScreenshot,
  onExportMeasurements,
  onNewProject,
  isFullscreen,
  showMeasurementTools,
  toggleMeasurementTools,
  showUpload
}) => {
  const mobileInfo = useIsMobile();
  const isPortrait = mobileInfo.isMobile && mobileInfo.isPortrait;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={300}>
        <div className="flex md:flex-row flex-wrap gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onReset} className="h-8 w-8 bg-background/90">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-background/90 border border-gray-300">
              <p>Ansicht zurücksetzen</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={toggleMeasurementTools}
                className="h-8 w-8 bg-background/90"
                disabled={isPortrait}
              >
                <Ruler className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-background/90 border border-gray-300">
              <p>
                {isPortrait 
                  ? "Messwerkzeuge sind im Hochformat deaktiviert" 
                  : showMeasurementTools ? "Messwerkzeuge ausblenden" : "Messwerkzeuge anzeigen"}
              </p>
            </TooltipContent>
          </Tooltip>
          
          {onScreenshot && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={onScreenshot} 
                  className="h-8 w-8 bg-background/90"
                  disabled={isPortrait}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-background/90 border border-gray-300">
                <p>{isPortrait ? "Screenshots nur im Querformat möglich" : "Screenshot erstellen"}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {onExportMeasurements && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onExportMeasurements} className="h-8 w-8 bg-background/90">
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-background/90 border border-gray-300">
                <p>Daten exportieren</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onFullscreen} className="h-8 w-8 bg-background/90">
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-background/90 border border-gray-300">
              <p>{isFullscreen ? "Vollbild beenden" : "Vollbild anzeigen"}</p>
            </TooltipContent>
          </Tooltip>
          
          {showUpload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onNewProject} className="h-8 w-8 bg-background/90 ml-2">
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-background/90 border border-gray-300">
                <p>Neues Projekt</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
};

export default ViewerControls;
