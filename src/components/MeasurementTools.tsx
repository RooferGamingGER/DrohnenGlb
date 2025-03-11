
import { useState } from 'react';
import { Ruler, Move, ArrowUpDown, Trash, Undo, X } from 'lucide-react';
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
  onDeleteMeasurement: (id: string) => void;
  onUndoLastPoint: () => void;
  measurements: Measurement[];
  canUndo: boolean;
}

const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  activeTool,
  onToolChange,
  onClearMeasurements,
  onDeleteMeasurement,
  onUndoLastPoint,
  measurements,
  canUndo
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
                  <ArrowUpDown size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Höhe messen</p>
              </TooltipContent>
            </Tooltip>
            
            {canUndo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onUndoLastPoint}
                    className="p-2 rounded-md hover:bg-secondary transition-colors"
                    aria-label="Letzten Punkt rückgängig machen"
                  >
                    <Undo size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Letzten Punkt rückgängig machen</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {measurements.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClearMeasurements}
                    className="p-2 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label="Alle Messungen löschen"
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
        <div className="text-xs space-y-1 max-w-[200px]">
          <h3 className="font-medium">Messungen:</h3>
          <ul className="space-y-2">
            {measurements.map((m) => (
              <li key={m.id} className="flex items-center justify-between bg-background/50 p-2 rounded">
                <span className="flex items-center gap-2">
                  {m.type === 'length' && <Ruler size={14} />}
                  {m.type === 'height' && <ArrowUpDown size={14} />}
                  <span>{m.value.toFixed(2)} {m.unit}</span>
                </span>
                <button 
                  onClick={() => onDeleteMeasurement(m.id)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                  aria-label="Messung löschen"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MeasurementTools;
