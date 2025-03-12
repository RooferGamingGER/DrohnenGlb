
import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Maximize, 
  Minimize, 
  Ruler, 
  Camera, 
  FileSpreadsheet,
  Home,
  X
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={300}>
        <div className="flex md:flex-row flex-wrap gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onReset} className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Ansicht zurücksetzen</p>
            </TooltipContent>
          </Tooltip>
          
          {showUpload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onNewProject} className="h-8 w-8">
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Neues Projekt</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={showMeasurementTools ? "default" : "outline"} 
                size="icon" 
                onClick={toggleMeasurementTools}
                className="h-8 w-8"
              >
                {showMeasurementTools ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Ruler className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{showMeasurementTools ? "Messwerkzeuge ausblenden" : "Messwerkzeuge anzeigen"}</p>
            </TooltipContent>
          </Tooltip>
          
          {onScreenshot && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onScreenshot} className="h-8 w-8">
                  <Camera className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Screenshot erstellen</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {onExportMeasurements && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={onExportMeasurements} className="h-8 w-8">
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Messungen exportieren</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={onFullscreen} className="h-8 w-8">
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isFullscreen ? "Vollbild beenden" : "Vollbild anzeigen"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
};

export default ViewerControls;
