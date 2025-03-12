
import { Progress } from '@/components/ui/progress';

interface LoadingOverlayProps {
  progress: number;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ progress }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
      <div className="w-64 space-y-4">
        <h3 className="text-lg font-medium text-center">
          Modell wird geladen...
        </h3>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground text-center">
          {progress < 70 ? "Datei wird hochgeladen..." : "Modell wird verarbeitet..."}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
