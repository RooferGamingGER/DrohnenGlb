
import { useState, useEffect } from 'react';
import { Ruler, Move, ArrowUpDown, Trash, Undo, X, Pencil, Check } from 'lucide-react';
import { MeasurementType, Measurement } from '@/utils/measurementUtils';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
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
  onUpdateMeasurement: (id: string, data: Partial<Measurement>) => void;
  measurements: Measurement[];
  canUndo: boolean;
  onClose?: () => void;
  screenshots?: { id: string, imageDataUrl: string, description: string }[];
}

const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  activeTool,
  onToolChange,
  onClearMeasurements,
  onDeleteMeasurement,
  onUndoLastPoint,
  onUpdateMeasurement,
  measurements,
  canUndo,
  onClose
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Automatically disable measurement tool when editing a description
  useEffect(() => {
    if (editingId !== null && activeTool !== 'none') {
      onToolChange('none');
    }
  }, [editingId, activeTool, onToolChange]);

  const handleDeleteMeasurement = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDeleteMeasurement(id);
    // Disable measurement tool after deleting
    if (activeTool !== 'none') {
      onToolChange('none');
    }
  };

  const handleEditStart = (id: string, currentDescription: string = '', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Disable measurement tool when starting to edit
    if (activeTool !== 'none') {
      onToolChange('none');
    }
    setEditingId(id);
    setEditValue(currentDescription);
  };

  const handleEditSave = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onUpdateMeasurement(id, { description: editValue });
    setEditingId(null);
  };

  const handleInputClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const handleContainerClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Disable measurement tool when clicking anywhere in the container
    if (activeTool !== 'none') {
      onToolChange('none');
    }
  };

  return (
    <div 
      className="flex flex-col gap-4 bg-background/70 backdrop-blur-sm p-3 rounded-lg shadow-lg"
      onClick={handleContainerClick}
      onMouseDown={handleContainerClick}
      onMouseUp={handleContainerClick}
    >
      <div className="flex flex-col gap-2">
        <TooltipProvider delayDuration={300}>
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
              <TooltipContent side="right">
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
              <TooltipContent side="right">
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
              <TooltipContent side="right">
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
                <TooltipContent side="right">
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
                <TooltipContent side="right">
                  <p>Alle Messungen löschen</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            {/* Add close button if onClose is provided */}
            {onClose && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-md hover:bg-secondary transition-colors"
                    aria-label="Messungswerkzeuge schließen"
                  >
                    <X size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Schließen</p>
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
              <li key={m.id} className="bg-background/40 p-2 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2">
                    {m.type === 'length' && <Ruler size={14} />}
                    {m.type === 'height' && <ArrowUpDown size={14} />}
                    <span>{m.value.toFixed(2)} {m.unit}</span>
                  </span>
                  <div className="flex items-center">
                    <button 
                      onClick={(e) => editingId === m.id ? handleEditSave(m.id, e) : handleEditStart(m.id, m.description, e)}
                      className="text-primary hover:bg-primary/10 p-1 rounded mr-1"
                      aria-label={editingId === m.id ? "Beschreibung speichern" : "Beschreibung bearbeiten"}
                    >
                      {editingId === m.id ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button 
                      onClick={(e) => handleDeleteMeasurement(m.id, e)}
                      className="text-destructive hover:bg-destructive/10 p-1 rounded"
                      aria-label="Messung löschen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                
                {editingId === m.id ? (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onClick={handleInputClick}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Beschreibung hinzufügen"
                    className="h-7 text-xs"
                    autoFocus
                  />
                ) : (
                  m.description && (
                    <p className="text-muted-foreground text-xs break-words">
                      {m.description}
                    </p>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MeasurementTools;
