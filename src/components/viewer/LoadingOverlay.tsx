
import { Progress } from '@/components/ui/progress';

interface LoadingOverlayProps {
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ progress }) => {
  // Detailed progress status function
  const getProgressStatus = (progress: number) => {
    if (progress < 10) return "Ladevorgang wird initialisiert...";
    if (progress < 25) return "Verbindung wird hergestellt...";
    if (progress < 40) return "Datei wird hochgeladen...";
    if (progress < 60) return "Modell wird verarbeitet...";
    if (progress < 85) return "Texturen werden geladen...";
    if (progress < 95) return "Vorschau wird vorbereitet...";
    return "Ladevorgang abgeschlossen";
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
      <div className="w-64 space-y-4">
        <h3 className="text-lg font-medium text-center">
          Modell wird geladen...
        </h3>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground text-center">
          {getProgressStatus(progress)}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
