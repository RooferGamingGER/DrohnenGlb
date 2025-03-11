
import ModelViewer from '@/components/ModelViewer';

const Index = () => {
  return (
    <div className="h-full w-full overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-4xl mx-auto p-4 mb-8">
        <div className="flex flex-col items-center gap-6 mb-8">
          <img 
            src="/lovable-uploads/707b2373-73e2-44d4-ac8e-b809aaca3851.png" 
            alt="Drohnenvermessung by RooferGaming" 
            className="w-64 md:w-80"
          />
          <p className="text-center text-muted-foreground">
            Laden Sie ein 3D-Modell im GLB-Format hoch, um es zu betrachten.
          </p>
        </div>
      </div>
      <ModelViewer />
    </div>
  );
};

export default Index;
