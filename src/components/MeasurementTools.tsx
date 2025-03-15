
import { useState, useEffect } from 'react';
import { Ruler, Move, ArrowUpDown, Trash, Undo, X, Pencil, Check, List, Eye, EyeOff, Navigation, GripHorizontal, MapPin } from 'lucide-react';
import { MeasurementType, Measurement, isInclinationSignificant, MeasurementPoint } from '@/types/measurement';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  onToggleMeasurementVisibility?: (id: string) => void;
  onToggleAllMeasurementsVisibility?: () => void;
  allMeasurementsVisible?: boolean;
  onToggleEditMode?: (id: string) => void;
  screenshots?: { id: string, imageDataUrl: string, description: string }[];
  isMobile?: boolean;
  scrollThreshold?: number;
  tempPoints?: MeasurementPoint[];
  onDeleteTempPoint?: (index: number) => void;
  onDeleteSinglePoint?: (measurementId: string, pointIndex: number) => void;
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
  onClose,
  onToggleMeasurementVisibility,
  onToggleAllMeasurementsVisibility,
  allMeasurementsVisible = true,
  onToggleEditMode,
  screenshots,
  isMobile = false,
  scrollThreshold = 3,
  tempPoints = [],
  onDeleteTempPoint,
  onDeleteSinglePoint
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showMeasurementsList, setShowMeasurementsList] = useState(!isMobile);
  const [expandedMeasurement, setExpandedMeasurement] = useState<string | null>(null);

  useEffect(() => {
    if (editingId !== null && activeTool !== 'none') {
      onToolChange('none');
    }
  }, [editingId, activeTool, onToolChange]);

  const handleDeleteMeasurement = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDeleteMeasurement(id);
    if (activeTool !== 'none') {
      onToolChange('none');
    }
  };

  const handleEditStart = (id: string, currentDescription: string = '', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
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

  const handleToggleMeasurementVisibility = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onToggleMeasurementVisibility) {
      onToggleMeasurementVisibility(id);
    }
  };

  const handleToggleEditMode = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onToggleEditMode) {
      onToggleEditMode(id);
    }
  };

  const handleInputClick = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const handleContainerClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (activeTool !== 'none') {
      onToolChange('none');
    }
  };

  const handleToggleMeasurementsList = () => {
    setShowMeasurementsList(!showMeasurementsList);
  };

  const handleDeleteSinglePoint = (measurementId: string, pointIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onDeleteSinglePoint) {
      onDeleteSinglePoint(measurementId, pointIndex);
    }
  };

  const toggleMeasurementExpand = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpandedMeasurement(expandedMeasurement === id ? null : id);
  };

  return (
    <div 
      className={cn(
        "flex flex-col gap-4 bg-background/70 backdrop-blur-sm p-3 rounded-lg shadow-lg",
        isMobile && "max-w-full w-full"
      )}
      onClick={handleContainerClick}
    >
      <div className="flex flex-col gap-2">
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center justify-center gap-2">
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
              <TooltipContent side={isMobile ? "bottom" : "right"}>
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
              <TooltipContent side={isMobile ? "bottom" : "right"}>
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
              <TooltipContent side={isMobile ? "bottom" : "right"}>
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
                <TooltipContent side={isMobile ? "bottom" : "right"}>
                  <p>Letzten Punkt rückgängig machen</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {(measurements.length > 0 || tempPoints.length > 0) && (
            <div className="flex items-center justify-center gap-2">
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
                <TooltipContent side={isMobile ? "bottom" : "right"}>
                  <p>Alle Messungen löschen</p>
                </TooltipContent>
              </Tooltip>
              
              {onToggleAllMeasurementsVisibility && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={onToggleAllMeasurementsVisibility}
                      className="p-2 rounded-md hover:bg-secondary transition-colors"
                      aria-label={allMeasurementsVisible ? "Alle Messungen ausblenden" : "Alle Messungen einblenden"}
                    >
                      {allMeasurementsVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{allMeasurementsVisible ? "Alle Messungen ausblenden" : "Alle Messungen einblenden"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {isMobile && measurements.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleToggleMeasurementsList}
                      className="p-2 rounded-md hover:bg-secondary transition-colors"
                      aria-label={showMeasurementsList ? "Messungen ausblenden" : "Messungen einblenden"}
                    >
                      <List size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{showMeasurementsList ? "Messungen ausblenden" : "Messungen einblenden"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </TooltipProvider>
      </div>
      
      {measurements.length > 0 && showMeasurementsList && (
        <div className="text-xs space-y-1 max-w-full">
          <h3 className="font-medium">Messungen</h3>
          
          <ScrollArea className={measurements.length > scrollThreshold ? (isMobile ? "h-[120px]" : "h-[200px]") + " pr-2" : "max-h-full"}>
            <ul className="space-y-2">
              {/* Display completed measurements */}
              {measurements.map((m) => (
                <li key={m.id} className={cn(
                  "bg-background/40 p-2 rounded",
                  m.editMode && "border border-primary/70"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 cursor-pointer" onClick={(e) => toggleMeasurementExpand(m.id, e)}>
                      {m.type === 'length' && (
                        <>
                          <Ruler size={14} />
                          <span>
                            {m.value.toFixed(2)} {m.unit}
                            {m.inclination !== undefined && isInclinationSignificant(m.inclination) && (
                              <span className="ml-1 flex items-center">
                                | <Navigation size={12} className="mx-1" /> {m.inclination.toFixed(1)}°
                              </span>
                            )}
                          </span>
                        </>
                      )}
                      {m.type === 'height' && (
                        <>
                          <ArrowUpDown size={14} />
                          <span>{m.value.toFixed(2)} {m.unit}</span>
                        </>
                      )}
                    </span>
                    <div className="flex items-center">
                      {onToggleEditMode && (
                        <button 
                          onClick={(e) => handleToggleEditMode(m.id, e)}
                          className={cn(
                            "p-1 rounded mr-1",
                            m.editMode 
                              ? "text-primary-foreground bg-primary" 
                              : "text-primary hover:bg-primary/10"
                          )}
                          aria-label={m.editMode ? "Bearbeitungsmodus beenden" : "Punkte verschieben"}
                        >
                          <GripHorizontal size={14} />
                        </button>
                      )}
                      
                      {onToggleMeasurementVisibility && (
                        <button 
                          onClick={(e) => handleToggleMeasurementVisibility(m.id, e)}
                          className="text-primary hover:bg-primary/10 p-1 rounded mr-1"
                          aria-label={m.visible === false ? "Messung einblenden" : "Messung ausblenden"}
                        >
                          {m.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      )}
                      
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
                  
                  {m.editMode && (
                    <div className="mt-1 text-xs text-primary">
                      Klicken Sie einen Punkt an, um ihn zu verschieben
                    </div>
                  )}

                  {expandedMeasurement === m.id && m.points && m.points.length > 0 && (
                    <div className="mt-2 border-t border-gray-200 pt-2">
                      <h4 className="text-xs font-medium mb-1">Messpunkte</h4>
                      <ul className="space-y-1">
                        {m.points.map((point, idx) => (
                          <li key={idx} className="flex items-center justify-between bg-background/60 p-1 rounded">
                            <span className="flex items-center">
                              <MapPin size={12} className="mr-1" />
                              Punkt {idx + 1}
                            </span>
                            {onDeleteSinglePoint && (
                              <button
                                onClick={(e) => handleDeleteSinglePoint(m.id, idx, e)}
                                className="text-destructive hover:bg-destructive/10 p-1 rounded"
                                aria-label={`Punkt ${idx + 1} löschen`}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default MeasurementTools;
