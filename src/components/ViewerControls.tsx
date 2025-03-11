
import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, Maximize, Minus, Plus, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewerControlsProps {
  lightRotation: { x: number; y: number };
  setLightRotation: (rotation: { x: number; y: number }) => void;
  lightIntensity: number;
  setLightIntensity: (intensity: number) => void;
  resetView: () => void;
  resetLight: () => void;
}

const ViewerControls: React.FC<ViewerControlsProps> = ({
  lightRotation,
  setLightRotation,
  lightIntensity, 
  setLightIntensity,
  resetView,
  resetLight
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleLightXChange = (value: number[]) => {
    setLightRotation({ ...lightRotation, x: value[0] });
  };

  const handleLightYChange = (value: number[]) => {
    setLightRotation({ ...lightRotation, y: value[0] });
  };

  const handleLightIntensityChange = (value: number[]) => {
    setLightIntensity(value[0]);
  };

  return (
    <div 
      className={cn(
        "glass fixed right-4 p-4 rounded-lg shadow-sm transition-all duration-300 z-10",
        isExpanded ? "w-[300px]" : "w-auto"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn("font-medium text-sm", !isExpanded && "hidden")}>
          Modellsteuerung
        </h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-secondary rounded-md transition-colors"
          aria-label={isExpanded ? "Minimieren" : "Maximieren"}
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Lichtposition X</span>
              <button 
                onClick={() => setLightRotation({...lightRotation, x: 0})}
                className="text-xs p-1 hover:bg-secondary rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="w-3 h-3 text-muted-foreground" />
              <Slider
                value={[lightRotation.x]}
                min={-180}
                max={180}
                step={1}
                onValueChange={handleLightXChange}
              />
              <Plus className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Lichtposition Y</span>
              <button 
                onClick={() => setLightRotation({...lightRotation, y: 0})}
                className="text-xs p-1 hover:bg-secondary rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <RotateCw className="w-3 h-3 text-muted-foreground rotate-90" />
              <Slider
                value={[lightRotation.y]}
                min={-180}
                max={180}
                step={1}
                onValueChange={handleLightYChange}
              />
              <RotateCw className="w-3 h-3 text-muted-foreground -rotate-90" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Lichtintensität</span>
              <button 
                onClick={() => setLightIntensity(1)}
                className="text-xs p-1 hover:bg-secondary rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="w-3 h-3 text-muted-foreground" />
              <Slider
                value={[lightIntensity]}
                min={0}
                max={2}
                step={0.05}
                onValueChange={handleLightIntensityChange}
              />
              <Plus className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <button
              onClick={resetView}
              className="flex-1 p-2 text-sm border border-border rounded hover:bg-secondary transition-colors"
            >
              Ansicht zurücksetzen
            </button>
            <button
              onClick={resetLight}
              className="flex-1 p-2 text-sm border border-border rounded hover:bg-secondary transition-colors"
            >
              Licht zurücksetzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerControls;
