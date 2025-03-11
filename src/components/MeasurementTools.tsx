
import { useState, useEffect } from 'react';
import { Ruler, Move, ArrowUpDown, Trash, Undo, X, Pencil, Check, MinusSquare } from 'lucide-react';
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
}

const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  activeTool,
  onToolChange,
  onClearMeasurements,
  onDeleteMeasurement,
  onUndoLastPoint,
  onUpdateMeasurement,
  measurements,
  canUndo
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
      className="flex flex-col gap-4 bg-white border border-gray-200 rounded-lg shadow-sm"
      onClick={handleContainerClick}
      onMouseDown={handleContainerClick}
      onMouseUp={handleContainerClick}
    >
      <div className="p-2 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Messwerkzeuge</h3>
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('none')}
                  className={cn(
                    "p-2 rounded border transition-colors",
                    activeTool === 'none' 
                      ? "bg-blue-50 border-blue-300 text-blue-700" 
                      : "border-gray-200 hover:bg-gray-50"
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
                    "p-2 rounded border transition-colors",
                    activeTool === 'length' 
                      ? "bg-blue-50 border-blue-300 text-blue-700" 
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                  aria-label="Distanz messen"
                >
                  <Ruler size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Distanz messen</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('height')}
                  className={cn(
                    "p-2 rounded border transition-colors",
                    activeTool === 'height' 
                      ? "bg-blue-50 border-blue-300 text-blue-700" 
                      : "border-gray-200 hover:bg-gray-50"
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
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToolChange('area')}
                  className={cn(
                    "p-2 rounded border transition-colors",
                    activeTool === 'area' 
                      ? "bg-blue-50 border-blue-300 text-blue-700" 
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                  aria-label="Fläche messen"
                >
                  <MinusSquare size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Fläche messen</p>
              </TooltipContent>
            </Tooltip>
            
            {canUndo && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onUndoLastPoint}
                    className="p-2 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
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
                    className="p-2 rounded border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
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
        <div className="px-3 pb-3 pt-1 max-h-[300px] overflow-y-auto">
          <h3 className="text-xs font-medium text-gray-700 mb-2">Messungen:</h3>
          <ul className="space-y-2">
            {measurements.map((m) => (
              <li key={m.id} className="bg-white border border-gray-200 p-2 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2">
                    {m.type === 'length' && <Ruler size={14} className="text-blue-600" />}
                    {m.type === 'height' && <ArrowUpDown size={14} className="text-blue-600" />}
                    {m.type === 'area' && <MinusSquare size={14} className="text-blue-600" />}
                    <span className="text-sm">{m.value.toFixed(2)} {m.unit}</span>
                  </span>
                  <div className="flex items-center">
                    <button 
                      onClick={(e) => editingId === m.id ? handleEditSave(m.id, e) : handleEditStart(m.id, m.description, e)}
                      className="text-blue-600 hover:bg-blue-50 p-1 rounded mr-1"
                      aria-label={editingId === m.id ? "Beschreibung speichern" : "Beschreibung bearbeiten"}
                    >
                      {editingId === m.id ? <Check size={14} /> : <Pencil size={14} />}
                    </button>
                    <button 
                      onClick={(e) => handleDeleteMeasurement(m.id, e)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
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
                    <p className="text-gray-500 text-xs break-words">
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
