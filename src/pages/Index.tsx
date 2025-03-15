
import { useIsMobile } from '@/hooks/use-mobile';
import ModelViewer from '@/components/ModelViewer';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  return (
    <div className="h-full w-full flex items-center justify-center overflow-hidden">
      <div className={`${isPortrait ? 'h-full w-full' : 'h-[90%] w-[90%] max-w-7xl'}`}>
        <ModelViewer forceHideHeader={false} />
      </div>
    </div>
  );
};

export default Index;
