
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react';
import ModelViewer from '@/components/ModelViewer';
import { Card } from '@/components/ui/card';

const Index = () => {
  const { isPortrait } = useIsMobile();
  
  // Directly render the ModelViewer component with forceHideHeader set to false to show the upload interface
  return <ModelViewer forceHideHeader={false} />;
};

export default Index;
