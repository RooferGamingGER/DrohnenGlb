
import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Maximize, 
  Minimize, 
  Ruler, 
  Camera, 
  FileText,
  Home,
  ArrowLeft,
  RotateCcw
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
  const isMobile = mobileInfo.isMobile;

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={300}>
        <div className="flex md:flex-row flex-wrap gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onReset} className="h-8 w-8 bg-blue-600 rounded-full border border-blue-500 text-white">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-zinc-800 border border-zinc-700">
              <p>Ansicht zurücksetzen</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMeasurementTools}
                className="h-8 w-8 bg-blue-600 rounded-full border border-blue-500 text-white"
              >
                <Ruler className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-zinc-800 border border-zinc-700">
              <p>{showMeasurementTools ? "Messwerkzeuge ausblenden" : "Messwerkzeuge anzeigen"}</p>
            </TooltipContent>
          </Tooltip>
          
          {onScreenshot && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onScreenshot} 
                  className="h-8 w-8 bg-blue-600 rounded-full border border-blue-500 text-white"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-800 border border-zinc-700">
                <p>Screenshot erstellen</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {onExportMeasurements && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onExportMeasurements} 
                  className="h-8 w-8 bg-blue-600 rounded-full border border-blue-500 text-white"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-800 border border-zinc-700">
                <p>Daten exportieren</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onFullscreen} 
                className="h-8 w-8 bg-blue-600 rounded-full border border-blue-500 text-white"
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-zinc-800 border border-zinc-700">
              <p>{isFullscreen ? "Vollbild beenden" : "Vollbild anzeigen"}</p>
            </TooltipContent>
          </Tooltip>
          
          {showUpload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onNewProject} 
                  className="h-8 w-8 bg-blue-600 rounded-full border border-blue-500 text-white ml-2"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-800 border border-zinc-700">
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
