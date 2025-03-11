
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Upload } from 'lucide-react';

interface LoadingOverlayProps {
  progress: number;
  isUploading: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  progress,
  isUploading,
}) => {
  const getMessage = () => {
    if (progress < 50) {
      return 'Datei wird hochgeladen';
    } else if (progress < 75) {
      return 'Datei wird verarbeitet';
    } else if (progress < 100) {
      return 'Modell wird vorbereitet';
    } else {
      return 'Modell wird geladen';
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-card p-6 rounded-lg shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Upload className="w-5 h-5 animate-pulse" />
              <h3 className="text-lg font-semibold">{getMessage()}</h3>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">{progress}% abgeschlossen</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
