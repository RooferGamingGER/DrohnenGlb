import { useState, useEffect, useRef } from 'react';
import { Ruler, Move, ArrowUpDown, Trash, Undo, X, Pencil, Check, Square, GripVertical } from 'lucide-react';
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
  const [showMeasurementsList, setShowMeasurementsList] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedPosition = localStorage.getItem('measurementToolsPosition');
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const containerWidth = 240;
        const containerHeight = 300;

        const x = Math.max(0, Math.min(parsed.x, viewportWidth - containerWidth));
        const y = Math.max(0, Math.min(parsed.y, viewportHeight - containerHeight));
        
        setPosition({ x, y });
      } catch (e) {
        console.error('Error parsing saved position:', e);
        setPosition({ x: 20, y: 80 });
      }
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;

        setPosition(prevPosition => {
          const x = Math.max(0, Math.min(prevPosition.x, viewportWidth - containerWidth));
          const y = Math.max(0, Math.min(prevPosition.y, viewportHeight - containerHeight));
          return { x, y };
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (position.x !== 0 || position.y !== 0) {
      localStorage.setItem('measurementToolsPosition', JSON.stringify(position));
    }
  }, [position]);

  useEffect(() => {
    if (editingId !== null && activeTool !== 'none') {
      onToolChange('none');
    }
  }, [editingId, activeTool, onToolChange]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragHandleRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
    
    const eventType = 'touches' in e ? 'touch' : 'mouse';
    const clientX = eventType === 'touch' ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = eventType === 'touch' ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    
    setIsDragging(true);
    
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      
      const moveType = 'touches' in moveEvent ? 'touch' : 'mouse';
      const moveClientX = moveType === 'touch' ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const moveClientY = moveType === 'touch' ? (moveEvent as TouchEvent).touches[0].clientY : (moveEvent as MouseEvent).clientY;
      
      const newX = moveClientX - offsetX;
      const newY = moveClientY - offsetY;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      const constrainedX = Math.max(0, Math.min(newX, viewportWidth - containerWidth));
      const constrainedY = Math.max(0, Math.min(newY, viewportHeight - containerHeight));
      
      setPosition({ x: constrainedX, y: constrainedY });
    };
    
    const handleEnd = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
  };

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
    if (activeTool !== 'none') {
      onToolChange('none');
    }
  };

  const toggleMeasurementsList = () => {
    setShowMeasurementsList(!showMeasurementsList);
  };

  const containerStyle = {
    position: 'fixed' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    cursor: isDragging ? 'grabbing' : 'auto',
    transform: 'none',
    maxWidth: '240px',
    zIndex: 1000,
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col gap-4 bg-background/70 backdrop-blur-sm p-3 rounded-lg shadow-lg"
      onClick={handleContainerClick}
      onMouseDown={handleContainerClick}
      onMouseUp={handleContainerClick}
      style={containerStyle}
    >
      <div 
        ref={dragHandleRef}
        className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab hover:bg-secondary/50 rounded-t-lg"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      
      {onClose && (
        <button 
          onClick={onClose}
          className="sm:hidden absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <div className="flex flex-row sm:flex-col gap-2 justify-center mt-2">
        <TooltipProvider>
          <div className="flex flex-row sm:flex-col items-center gap-2">
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
                  <Square size={18} />
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
        <div className="text-xs">
          <button
            onClick={toggleMeasurementsList}
            className="w-full px-2 py-1 bg-secondary text-secondary-foreground rounded flex items-center justify-between font-medium"
          >
            <span>Messungen ({measurements.length})</span>
            <ChevronIcon isOpen={showMeasurementsList} />
          </button>
          
          {showMeasurementsList && (
            <ul className="mt-2 space-y-2 max-h-[40vh] overflow-y-auto">
              {measurements.map((m) => (
                <li key={m.id} className="bg-background/40 p-2 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2">
                      {m.type === 'length' && <Ruler size={14} />}
                      {m.type === 'height' && <ArrowUpDown size={14} />}
                      {m.type === 'area' && <Square size={14} />}
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
          )}
        </div>
      )}
    </div>
  );
};

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg 
    width="12" 
    height="12" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform transform ${isOpen ? 'rotate-180' : ''}`}
  >
    <path 
      d="M6 9L12 15L18 9" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
  </svg>
);

export default MeasurementTools;
