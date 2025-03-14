
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useEffect } from 'react';
import ModelViewer from '@/components/ModelViewer';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  // Render the ModelViewer component with forceHideHeader set to false
  // This will allow the component to determine header visibility based on its internal logic
  return <ModelViewer forceHideHeader={false} />;
};

export default Index;
