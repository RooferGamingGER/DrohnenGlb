
import { useState, useRef } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { formatFileSize, validateFile } from '@/utils/modelUtils';
import { useToast } from '@/hooks/use-toast';

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
      className={`relative p-6 rounded-lg border-2 border-dashed transition-all duration-300 ${
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

      <div className="flex flex-col items-center justify-center space-y-3 py-4">
        <div className={`rounded-full p-3 ${isDragging ? 'bg-primary/10 text-primary' : 'bg-secondary'}`}>
          <UploadCloud 
            className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-primary/50'} ${
              isLoading ? 'animate-pulse' : 'animate-float'
            }`} 
          />
        </div>

        {isLoading ? (
          <div className="w-full max-w-xs">
            <div className="flex justify-between mb-1 text-sm">
              <span>Wird geladen...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            {selectedFile ? (
              <div className="text-center">
                <h3 className="font-medium text-foreground">{selectedFile.name}</h3>
                <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                <p className="text-xs text-muted-foreground mt-1">Klicken Sie, um eine andere Datei auszuwählen</p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="font-medium text-foreground">GLB-Datei hochladen</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Ziehen Sie eine Datei hierher oder klicken Sie, um auszuwählen
                </p>
                <div className="flex items-center justify-center mt-2 text-xs gap-1 text-muted-foreground">
                  <AlertCircle className="w-3 h-3" />
                  <span>Nur GLB-Dateien (max. 100MB)</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UploadArea;
