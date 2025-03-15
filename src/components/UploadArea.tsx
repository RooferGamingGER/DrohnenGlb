
import { useState, useRef, useEffect } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { formatFileSize, validateFile } from '@/utils/modelUtils';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface UploadAreaProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  progress: number;
}

const UploadArea: React.FC<UploadAreaProps> = ({ onFileSelected, isLoading, progress }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const triggerFileInput = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Add touch event handlers
  useEffect(() => {
    const uploadArea = uploadAreaRef.current;
    if (!uploadArea) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      // We don't prevent default here to allow scrolling if needed
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      // Only trigger if this is the target element (not children)
      if (e.target === uploadArea || uploadArea.contains(e.target as Node)) {
        e.preventDefault();
        
        // Use timeout to ensure the event completes properly
        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }, 10);
      }
    };
    
    uploadArea.addEventListener('touchstart', handleTouchStart, { passive: true });
    uploadArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      uploadArea.removeEventListener('touchstart', handleTouchStart);
      uploadArea.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const processFile = (file: File) => {
    if (!validateFile(file)) {
      toast({
        title: "Ungültiges Format",
        description: "Bitte wählen Sie eine GLB-Datei aus (max. 100MB).",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    onFileSelected(file);
  };

  return (
    <div
      ref={uploadAreaRef}
      className={`relative p-3 rounded-lg border-2 border-dashed transition-all duration-300 
                  ${isDragging ? 'border-primary bg-primary/10' : 'border-primary/30 hover:border-primary/70 hover:bg-white/5'} 
                  ${selectedFile ? 'bg-primary/5' : ''} 
                  shadow-lg backdrop-blur-sm hover:shadow-primary/10 touch-manipulation`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept=".glb"
        className="hidden"
      />

      <div className="flex items-center gap-3 py-2">
        <div className={`rounded-full p-3 ${isDragging ? 'bg-primary/20 text-primary' : 'bg-primary/10'}`}>
          <UploadCloud
            className={`w-5 h-5 ${isDragging ? 'text-primary' : 'text-primary/80'} ${
              isLoading ? 'animate-pulse' : 'animate-float'
            }`}
          />
        </div>

        {isLoading ? (
          <div className="w-full space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{progress < 100 ? 'Upload...' : 'Verarbeitung...'}</span>
              <span className="text-primary font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        ) : (
          <div className="flex-1">
            {selectedFile ? (
              <div>
                <p className="text-sm font-medium truncate max-w-[180px]">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">GLB-Datei hochladen</p>
                <p className="text-xs text-muted-foreground hidden md:block">
                  Ziehen Sie eine Datei hierher oder klicken
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadArea;
