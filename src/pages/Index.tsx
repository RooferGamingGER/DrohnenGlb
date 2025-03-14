
import { useIsMobile } from '@/hooks/use-mobile';
import ModelViewer from '@/components/ModelViewer';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  // Render the ModelViewer component with forceHideHeader set to false
  // This will allow the component to determine header visibility based on its internal logic
  return (
    <div className="h-full w-full overflow-hidden">
      <ModelViewer forceHideHeader={false} />
    </div>
  );
};

export default Index;
