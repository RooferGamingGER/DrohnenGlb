
import ModelViewer from '@/components/ModelViewer';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  // Extract filename from URL or use a default
  const getFilename = () => {
    // In a real app, this would come from the actual file
    return "Musterprojekt";
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-white">
      {/* Header-Navigationsleiste */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white text-zinc-900 px-4 py-2 flex items-center border-b border-zinc-200">
        <div className="flex items-center space-x-2 text-sm">
          <span className="font-medium">Projekt: {getFilename()}</span>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-md px-4">
            <Printer className="h-4 w-4 mr-2" />
            Drucken
          </Button>
        </div>
      </div>
      
      <ModelViewer />
    </div>
  );
};

export default Index;
