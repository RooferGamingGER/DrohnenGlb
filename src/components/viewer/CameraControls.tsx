
import React from 'react';
import { Orbit, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraControlsProps {
  activeMode: 'none' | 'orbit' | 'rotate';
  onModeChange: (mode: 'none' | 'orbit' | 'rotate') => void;
}

const CameraControls: React.FC<CameraControlsProps> = ({ activeMode, onModeChange }) => {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex gap-2">
      <Button
        variant={activeMode === 'rotate' ? "default" : "secondary"}
        size="icon"
        className="w-12 h-12 rounded-full shadow-lg bg-opacity-80 backdrop-blur-sm"
        onClick={() => onModeChange('rotate')}
        title="Modell horizontal drehen"
      >
        <RotateCw 
          className={`h-6 w-6 ${activeMode === 'rotate' ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        />
      </Button>
      
      <Button
        variant={activeMode === 'orbit' ? "default" : "secondary"}
        size="icon"
        className="w-12 h-12 rounded-full shadow-lg bg-opacity-80 backdrop-blur-sm"
        onClick={() => onModeChange('orbit')}
        title="Orbit-Kamerasteuerung (3D-Rotation)"
      >
        <Orbit 
          className={`h-6 w-6 ${activeMode === 'orbit' ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        />
      </Button>
    </div>
  );
};

export default CameraControls;
