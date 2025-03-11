
import React from 'react';
import { Info, Upload } from 'lucide-react';

interface LoadingOverlayProps {
  progress: number;
  showInstructions: boolean;
  isUploading: boolean;
  onCloseInstructions: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  progress,
  showInstructions,
  isUploading,
  onCloseInstructions,
}) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card p-6 rounded-lg shadow-lg">
          <div className="space-y-4">
            {isUploading ? (
              <>
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Upload className="w-5 h-5 animate-pulse" />
                  <h3 className="text-lg font-semibold">Datei wird hochgeladen</h3>
                </div>
                <p className="text-sm text-center text-muted-foreground">Bitte warten Sie, während die Datei hochgeladen wird...</p>
              </>
            ) : progress < 100 ? (
              <>
                <h3 className="text-lg font-semibold text-center">Modell wird verarbeitet</h3>
                <p className="text-sm text-center text-muted-foreground">Das Modell wird vorbereitet für die Anzeige...</p>
              </>
            ) : showInstructions ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
