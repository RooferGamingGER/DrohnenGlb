
import MeasurementTools from '@/components/MeasurementTools';
import { Measurement, MeasurementType } from '@/utils/measurementUtils';

interface MeasurementToolsPanelProps {
  measurements: Measurement[];
  activeTool: MeasurementType;
  onToolChange: (tool: MeasurementType) => void;
  onClearMeasurements: () => void;
  onDeleteMeasurement: (id: string) => void;
  onUndoLastPoint: () => void;
  onUpdateMeasurement: (id: string, data: Partial<Measurement>) => void;
  onToggleMeasurementVisibility: (id: string) => void;
  onToggleAllMeasurementsVisibility: () => void;
  allMeasurementsVisible: boolean;
  canUndo: boolean;
  onClose: () => void;
  screenshots: { id: string, imageDataUrl: string, description: string }[];
  isMobile: boolean;
  isFullscreen: boolean;
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
  allMeasurementsVisible,
  canUndo,
  onClose,
  screenshots,
  isMobile,
  isFullscreen
}) => {
  return (
    <div 
      className={`${isMobile ? 'fixed bottom-0 left-0 right-0 px-2 pb-2' : 'absolute top-20 left-4'} z-20 ${isFullscreen ? 'fixed' : ''}`}
    >
      <MeasurementTools
        activeTool={activeTool}
        onToolChange={onToolChange}
        onClearMeasurements={onClearMeasurements}
        onDeleteMeasurement={onDeleteMeasurement}
        onUndoLastPoint={onUndoLastPoint}
        onUpdateMeasurement={onUpdateMeasurement}
        onToggleMeasurementVisibility={onToggleMeasurementVisibility}
        onToggleAllMeasurementsVisibility={onToggleAllMeasurementsVisibility}
        allMeasurementsVisible={allMeasurementsVisible}
        measurements={measurements}
        canUndo={canUndo}
        onClose={onClose}
        screenshots={screenshots}
        isMobile={isMobile}
        scrollThreshold={isMobile ? 3 : 5}
      />
    </div>
  );
};

export default MeasurementToolsPanel;
