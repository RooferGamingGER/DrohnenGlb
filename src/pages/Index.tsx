
import ModelViewer from '@/components/ModelViewer';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

const Index = () => {
  return (
    <div className="h-screen w-full overflow-hidden bg-black">
      {/* Header-Navigationsleiste */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-zinc-900 text-white px-4 py-2 flex items-center">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-zinc-400">Projekte</span>
          <ChevronRight className="h-4 w-4 text-zinc-500" />
          <span className="font-medium">3D Model</span>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-4">
            Teilen
          </Button>
        </div>
      </div>
      
      <ModelViewer />
    </div>
  );
};

export default Index;
