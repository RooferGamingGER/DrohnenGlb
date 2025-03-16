
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
        <div className="flex md:flex-row flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onReset} 
                className="h-10 w-10 bg-primary/90 rounded-full border border-primary/30 text-primary-foreground hover:bg-primary hover:scale-105 transition-all duration-200 shadow-md"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-md">
              <p>Ansicht zurücksetzen</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={showMeasurementTools ? "secondary" : "ghost"}
                size="icon" 
                onClick={toggleMeasurementTools}
                className={`h-10 w-10 rounded-full border border-primary/30 text-primary-foreground ${showMeasurementTools ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary/90 hover:bg-primary'} hover:scale-105 transition-all duration-200 shadow-md`}
              >
                <Ruler className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-md">
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
                  className="h-10 w-10 bg-primary/90 rounded-full border border-primary/30 text-primary-foreground hover:bg-primary hover:scale-105 transition-all duration-200 shadow-md"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-md">
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
                  className="h-10 w-10 bg-primary/90 rounded-full border border-primary/30 text-primary-foreground hover:bg-primary hover:scale-105 transition-all duration-200 shadow-md"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-md">
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
                className="h-10 w-10 bg-primary/90 rounded-full border border-primary/30 text-primary-foreground hover:bg-primary hover:scale-105 transition-all duration-200 shadow-md"
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-md">
              <p>{isFullscreen ? "Vollbild beenden" : "Vollbild anzeigen"}</p>
            </TooltipContent>
          </Tooltip>
          
          {showUpload && onNewProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onNewProject} 
                  className="h-10 w-10 bg-primary/90 rounded-full border border-primary/30 text-primary-foreground hover:bg-primary hover:scale-105 transition-all duration-200 shadow-md ml-2"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-md">
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
