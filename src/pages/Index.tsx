
import { useIsMobile } from '@/hooks/use-mobile';
import ModelViewer from '@/components/ModelViewer';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  return (
    <div className="h-full w-full overflow-hidden">
      <ModelViewer forceHideHeader={false} />
    </div>
  );
};

export default Index;
