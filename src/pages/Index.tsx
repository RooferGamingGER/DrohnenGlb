
import ModelViewer from '@/components/ModelViewer';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

const Index = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Welcome toast with instructions
    toast({
      title: "Willkommen bei Drohnenaufmaß",
      description: "Laden Sie ein 3D-Modell im GLB-Format hoch, um es zu betrachten.",
      duration: 5000,
    });
  }, [toast]);

  return (
    <div className="h-full w-full overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      <ModelViewer />
    </div>
  );
};

export default Index;
