
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Info } from 'lucide-react';

interface LoadingOverlayProps {
  progress: number;
  showInstructions: boolean;
  onCloseInstructions: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  progress,
  showInstructions,
  onCloseInstructions,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card p-6 rounded-lg shadow-lg">
          <div className="space-y-4">
            {progress < 100 ? (
              <>
                <h3 className="text-lg font-semibold text-center">Modell wird geladen</h3>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">{progress}% abgeschlossen</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Info className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Modellsteuerung</h3>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>• Klicken und ziehen zum Drehen des Modells</p>
                  <p>• Scrollen oder Pinch-Geste zum Zoomen</p>
                  <p>• Zwei Finger zum Verschieben</p>
                  <p>• Doppelklick zum Zurücksetzen der Ansicht</p>
                </div>
                <button
                  onClick={onCloseInstructions}
                  className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Verstanden
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
