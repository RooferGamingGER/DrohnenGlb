import React, { useState, useEffect, useCallback } from 'react';
import { Measurement, MeasurementType, MeasurementPoint, calculatePolygonArea, clearPreviewObjects } from '@/utils/measurementUtils';
import { Button } from '@/components/ui/button';
import { HelpCircle, Ruler, Trash2, ChevronLeft, ChevronRight, 
         ArrowUpDown, Square, Undo2, ScreenShare, 
         BringToFront, SendToBack, Pencil, Maximize2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MeasurementToolsPanelProps {
  measurements: Measurement[];
  activeTool: MeasurementType;
  onToolChange: (tool: MeasurementType) => void;
  onClearMeasurements: () => void;
  onDeleteMeasurement: (id: string) => void;
  onUndoLastPoint?: () => void;
  onUpdateMeasurement: (id: string, data: Partial<Measurement>) => void;
  onToggleMeasurementVisibility: (id: string) => void;
  onToggleAllMeasurementsVisibility: () => void;
  onToggleEditMode: (id: string) => void;
  allMeasurementsVisible: boolean;
  canUndo?: boolean;
  screenshots?: {id: string, imageDataUrl: string, description: string}[];
  isMobile?: boolean;
  isFullscreen?: boolean;
  onNewProject?: () => void;
  onTakeScreenshot?: () => void;
  tempPoints?: MeasurementPoint[];
  onDeleteTempPoint?: (index: number) => void;
  onDeleteSinglePoint?: (measurementId: string, pointIndex: number) => void;
  onClosePolygon?: () => void;
  canClosePolygon?: boolean;
}

const MeasurementToolsPanel: React.FC<MeasurementToolsPanelProps> = ({
  measurements,
  activeTool,
  onToolChange,
  onClearMeasurements,
  onDeleteMeasurement,
  onUndoLastPoint,
  onUpdateMeasurement,
  onToggleMeasurementVisibility,
  onToggleAllMeasurementsVisibility,
  onToggleEditMode,
  allMeasurementsVisible,
  canUndo = false,
  screenshots = [],
  isMobile = false,
  isFullscreen = false,
  onNewProject,
  onTakeScreenshot,
  tempPoints = [],
  onDeleteTempPoint,
  onDeleteSinglePoint,
  onClosePolygon,
  canClosePolygon = false
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'measurements' | 'screenshots'>('measurements');
  const [tempPointsOpen, setTempPointsOpen] = useState(true);
  
  useEffect(() => {
    if (tempPoints && tempPoints.length > 0) {
      setTempPointsOpen(true);
    }
  }, [tempPoints]);
  
  const canClosePolygonValue = activeTool === 'area' && tempPoints && tempPoints.length >= 3;
  
  const renderToolButtons = () => (
    <div className="flex flex-wrap gap-1 sm:gap-2 justify-center sm:justify-start pb-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === 'none' ? "default" : "outline"}
            size="icon"
            onClick={() => onToolChange('none')}
            aria-label="Selektionsmodus"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Selektionsmodus</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === 'length' ? "default" : "outline"}
            size="icon"
            onClick={() => onToolChange('length')}
            aria-label="Längenmessung"
          >
            <Ruler className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Längenmessung</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === 'height' ? "default" : "outline"}
            size="icon"
            onClick={() => onToolChange('height')}
            aria-label="Höhenmessung"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Höhenmessung</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === 'area' ? "default" : "outline"}
            size="icon"
            onClick={() => onToolChange('area')}
            aria-label="Flächenmessung"
          >
            <Square className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Flächenmessung</p>
        </TooltipContent>
      </Tooltip>
      
      {onUndoLastPoint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                onClick={onUndoLastPoint}
                disabled={!canUndo}
                aria-label="Letzten Punkt zurücksetzen"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Letzten Punkt zurücksetzen</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {onClosePolygon && canClosePolygonValue && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={onClosePolygon}
              size="sm"
              className="font-semibold"
              aria-label="Polygon schließen"
            >
              Polygon schließen
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Flächenmessung abschließen</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
  
  const renderTempPoints = () => {
    if (!tempPoints || tempPoints.length === 0) return null;
    
    return (
      <Collapsible open={tempPointsOpen} onOpenChange={setTempPointsOpen} className="mb-4 border rounded-md p-2">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer hover:bg-accent/50 rounded-md p-1">
            <h3 className="text-sm font-medium">Temporäre Punkte ({tempPoints.length})</h3>
            <Button variant="ghost" size="sm">
              {tempPointsOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 mt-2">
            {tempPoints.map((point, index) => (
              <div key={`temp-point-${index}`} className="flex items-center justify-between text-xs p-1 hover:bg-accent/50 rounded-md">
                <span className="flex-1">Punkt {index + 1}</span>
                {onDeleteTempPoint && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDeleteTempPoint(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {onClosePolygon && canClosePolygonValue && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClosePolygon} 
              className="w-full mt-2"
            >
              Polygon schließen
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  const formatMeasurementValue = (measurement: Measurement) => {
    if (measurement.type === 'area') {
      return measurement.value < 0.01 ? 
        `${(measurement.value * 10000).toFixed(2)} cm²` : 
        `${measurement.value.toFixed(2)} m²`;
    }
    
    return `${measurement.value.toFixed(2)} ${measurement.unit}`;
  };
  
  const renderMeasurementsList = () => (
    <ScrollArea className="flex-1 min-h-0 px-1">
      {tempPoints && tempPoints.length > 0 && renderTempPoints()}
      
      {measurements.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground text-sm">
          <p>Keine Messungen vorhanden</p>
          <p className="mt-2 text-xs">Wählen Sie ein Messwerkzeug und klicken Sie auf das Modell, um eine Messung zu erstellen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {measurements.map((measurement) => (
            <div key={measurement.id} className="border rounded-md p-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {measurement.type === 'length' && <Ruler className="h-4 w-4" />}
                  {measurement.type === 'height' && <ArrowUpDown className="h-4 w-4" />}
                  {measurement.type === 'area' && <Square className="h-4 w-4" />}
                  <span className="font-medium">{formatMeasurementValue(measurement)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onToggleEditMode(measurement.id)}
                    aria-label={measurement.editMode ? "Bearbeitungsmodus beenden" : "Bearbeitungsmodus starten"}
                  >
                    <Pencil className="h-3.5 w-3.5" color={measurement.editMode ? "#22c55e" : "currentColor"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onToggleMeasurementVisibility(measurement.id)}
                    aria-label={measurement.visible ? "Ausblenden" : "Einblenden"}
                  >
                    {measurement.visible ? <BringToFront className="h-3.5 w-3.5" /> : <SendToBack className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDeleteMeasurement(measurement.id)}
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              
              {measurement.points.length > 0 && (
                <div className="mt-2 space-y-1 ml-2 text-xs text-muted-foreground">
                  {measurement.points.map((point, index) => (
                    <div key={`${measurement.id}-point-${index}`} className="flex items-center justify-between">
                      <span className="flex-1">Punkt {index + 1}</span>
                      {onDeleteSinglePoint && measurement.points.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onDeleteSinglePoint(measurement.id, index)}
                          aria-label="Punkt löschen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
  
  const renderScreenshotsList = () => (
    <ScrollArea className="flex-1 min-h-0 px-1">
      {screenshots.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground text-sm">
          <p>Keine Screenshots vorhanden</p>
          <p className="mt-2 text-xs">Verwenden Sie den Screenshot-Button, um Aufnahmen des Modells zu erstellen.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {screenshots.map((screenshot) => (
            <div key={screenshot.id} className="border rounded-md p-2 overflow-hidden">
              <img 
                src={screenshot.imageDataUrl} 
                alt={screenshot.description} 
                className="w-full h-auto object-cover rounded"
              />
              <p className="mt-1 text-sm text-center truncate">{screenshot.description}</p>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );
  
  const handleTogglePanel = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <div 
      className={`absolute transition-all bg-background border-l shadow-md z-10 ${
        isOpen ? 'right-0' : '-right-96'
      } top-0 bottom-0 h-full flex flex-col ${isFullscreen ? 'mt-0' : 'mt-14 sm:mt-0'} ${isMobile ? 'w-60' : 'w-72'}`}
    >
      <div className="absolute z-20 -left-8 top-5 bg-background border rounded-l-md p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTogglePanel}
          aria-label={isOpen ? "Panel einklappen" : "Panel ausklappen"}
        >
          {isOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>
      
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="font-semibold text-sm">Messwerkzeuge</h2>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleAllMeasurementsVisibility}
                aria-label={allMeasurementsVisible ? "Alle Messungen ausblenden" : "Alle Messungen einblenden"}
              >
                {allMeasurementsVisible ? <BringToFront className="h-4 w-4" /> : <SendToBack className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{allMeasurementsVisible ? "Alle Messungen ausblenden" : "Alle Messungen einblenden"}</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onClearMeasurements}
                aria-label="Alle Messungen löschen"
                disabled={measurements.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Alle Messungen löschen</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="p-3 border-b">
        {renderToolButtons()}
      </div>
      
      <div className="flex border-b text-sm">
        <button
          className={`flex-1 p-2 text-center ${activeTab === 'measurements' ? 'border-b-2 border-primary font-medium' : ''}`}
          onClick={() => setActiveTab('measurements')}
        >
          Messungen
        </button>
        <button
          className={`flex-1 p-2 text-center ${activeTab === 'screenshots' ? 'border-b-2 border-primary font-medium' : ''}`}
          onClick={() => setActiveTab('screenshots')}
        >
          Screenshots
        </button>
      </div>
      
      <div className="flex-1 flex flex-col min-h-0 p-3">
        {activeTab === 'measurements' ? renderMeasurementsList() : renderScreenshotsList()}
      </div>
      
      <div className="p-3 border-t">
        <div className="flex gap-2 justify-between">
          {onTakeScreenshot && (
            <Button
              variant="outline"
              size="sm"
              onClick={onTakeScreenshot}
              className="flex-1"
              aria-label="Screenshot erstellen"
            >
              <ScreenShare className="h-4 w-4 mr-1" />
              <span>Screenshot</span>
            </Button>
          )}
          
          {onNewProject && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNewProject}
              className="flex-1"
              aria-label="Neues Projekt"
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeasurementToolsPanel;
