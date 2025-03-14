
import ModelViewer from '@/components/ModelViewer';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-b from-background to-background/80 relative">
      <div className="block h-full">
        <ModelViewer forceHideHeader={true} />
      </div>
    </div>
  );
};

export default Index;
