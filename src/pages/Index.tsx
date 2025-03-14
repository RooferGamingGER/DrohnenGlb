
import ModelViewer from '@/components/ModelViewer';
import LandscapeWarning from '@/components/viewer/LandscapeWarning';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  return (
    <div className="h-screen w-full overflow-hidden bg-white relative">
      {isPortrait && <LandscapeWarning />}
      <div className={isPortrait ? "hidden" : "block h-full"}>
        <ModelViewer forceHideHeader={true} />
      </div>
    </div>
  );
};

export default Index;
