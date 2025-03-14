
import { useState, useEffect } from 'react';
import ModelViewer from '@/components/ModelViewer';
import LandscapeWarning from '@/components/viewer/LandscapeWarning';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const { isPortrait } = useIsMobile();
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    // Set loaded to true after component mounts
    setLoaded(true);
  }, []);
  
  return (
    <div className="h-screen w-full overflow-hidden bg-white relative">
      {isPortrait && <LandscapeWarning />}
      <div className={isPortrait ? "hidden" : "block h-full"}>
        {loaded && <ModelViewer forceHideHeader={true} />}
      </div>
    </div>
  );
};

export default Index;
