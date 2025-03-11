
import { useState } from 'react';
import { Ruler, Move, MinusSquare, AreaChart, Trash } from 'lucide-react';
import { MeasurementType, Measurement } from '@/utils/measurementUtils';
import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MeasurementToolsProps {
  activeTool: MeasurementType;
  onToolChange: (tool: MeasurementType) => void;
  onClearMeasurements: () => void;
  measurements: Measurement[];
}

const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  activeTool,
  onToolChange,
  onClearMeasurements,
  measurements
}) => {
  return (
    <div className="flex flex-col gap-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
      <div className="flex flex-col gap-2">
        <TooltipProvider>
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('none')}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    activeTool === 'none' 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                  )}
                  aria-label="Navigieren"
                >
                  <Move size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Navigieren</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('length')}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    activeTool === 'length' 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                  )}
                  aria-label="Länge messen"
                >
                  <Ruler size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Länge messen</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('height')}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    activeTool === 'height' 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                  )}
                  aria-label="Höhe messen"
                >
                  <MinusSquare size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Höhe messen</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('area')}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    activeTool === 'area' 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                  )}
                  aria-label="Fläche messen"
                >
                  <AreaChart size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Fläche messen</p>
              </TooltipContent>
            </Tooltip>
            
            {measurements.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClearMeasurements}
                    className="p-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Messungen löschen"
                  >
                    <Trash size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alle Messungen löschen</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      </div>
      
      {measurements.length > 0 && (
        <div className="text-xs space-y-1 max-w-[150px]">
          <h3 className="font-medium">Messungen:</h3>
          <ul className="space-y-1">
            {measurements.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>
                  {m.type === 'length' && 'Länge:'}
                  {m.type === 'height' && 'Höhe:'}
                  {m.type === 'area' && 'Fläche:'}
                </span>
                <span className="font-medium">{m.value.toFixed(2)} {m.unit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MeasurementTools;
