
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileUp } from 'lucide-react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelected, onDragOver, onDrop }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    onFileSelected(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div 
        className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">
          GLB-Datei hochladen
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
          Wähle Sie Ihre GLB-Datei um mit dem Upload zu beginnen. 
        </p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-3">
          Hinweis: GLB-Dateien können vom Server direkt vom Server heruntergeladen werden. Hierfür das Textured Model (glTF) laden. 
        </p>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Datei auswählen
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default DropZone;
