
import { Button } from "@/components/ui/button";
import { BackgroundOption } from "@/utils/modelUtils";
import { Maximize, RefreshCw, Upload } from "lucide-react";
import { Link } from "react-router-dom";

interface ViewerControlsProps {
  onReset: () => void;
  onSetBackground?: (background: BackgroundOption) => void;
  backgroundOptions?: BackgroundOption[];
  selectedBackground?: BackgroundOption;
  onFullscreen?: () => void;
  showMeasurementTools: boolean;
  toggleMeasurementTools: () => void;
  showUpload?: boolean;
}

const ViewerControls = ({
  onReset,
  onFullscreen,
  showMeasurementTools,
  toggleMeasurementTools,
  showUpload = false,
}: ViewerControlsProps) => {
  return (
    <div className="flex gap-2 items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={onReset}
        className="hover:bg-secondary"
        title="Ansicht zurücksetzen"
      >
        <RefreshCw size={18} />
      </Button>
      
      {showUpload && (
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-secondary"
          title="Neues Projekt"
          asChild
        >
          <Link to="/">
            <Upload size={18} />
          </Link>
        </Button>
      )}
      
      {onFullscreen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onFullscreen}
          className="hover:bg-secondary"
          title="Vollbild"
        >
          <Maximize size={18} />
        </Button>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMeasurementTools}
        className={showMeasurementTools ? "bg-primary text-primary-foreground" : ""}
      >
        Messwerkzeuge
      </Button>
    </div>
  );
};

export default ViewerControls;
