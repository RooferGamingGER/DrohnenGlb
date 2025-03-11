import { useState, useRef } from 'react';
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

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={`relative p-2 rounded-lg border border-dashed transition-all duration-300 ${
        isDragging 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50 hover:bg-secondary/50'
      } ${selectedFile ? 'bg-secondary/30' : ''}`}
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

      <div className="flex items-center gap-2 py-1">
        <div className={`rounded-full p-2 ${isDragging ? 'bg-primary/10 text-primary' : 'bg-secondary'}`}>
          <UploadCloud 
            className={`w-4 h-4 ${isDragging ? 'text-primary' : 'text-primary/50'} ${
              isLoading ? 'animate-pulse' : 'animate-float'
            }`} 
          />
        </div>

        {isLoading ? (
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs">
              <span>{progress < 100 ? 'Upload...' : 'Verarbeitung...'}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        ) : (
          <div className="flex-1">
            {selectedFile ? (
              <div>
                <p className="text-xs font-medium truncate max-w-[140px]">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium">GLB-Datei hochladen</p>
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
