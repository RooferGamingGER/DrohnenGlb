
import ModelViewer from '@/components/ModelViewer';

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
      </div>
      
      <ModelViewer />
    </div>
  );
};

export default Index;
