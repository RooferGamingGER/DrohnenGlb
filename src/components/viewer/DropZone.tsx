import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react';

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
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="flex flex-col md:flex-row w-full max-w-2xl">
        {/* DropZone-Fenster */}
        <div className="w-full md:w-1/2 p-4 flex flex-col justify-center mt-16 md:mt-0"> {/* Hinzugefügter margin-top */}
          <div
            className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">GLB-Datei hochladen</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
              Wähle Sie Ihre GLB-Datei um mit dem Upload zu beginnen.
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

        {/* "How It Works"-Fenster */}
        <div className="w-full md:w-1/2 p-4 flex flex-col justify-center">
          <div className="bg-white rounded-lg p-6 shadow">
            <h2 className="text-lg font-semibold mb-4">Erklärung</h2>

            <div className="flex items-center mb-4">
              <div className="bg-blue-100 rounded-full p-2 mr-4">
                <ArrowDown className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">Export vom Server</h3>
                <p className="text-sm text-gray-500">Exportiere die Datei "Textured Model (glTF)"</p>
              </div>
            </div>

            <div className="flex items-center mb-4">
              <div className="bg-blue-100 rounded-full p-2 mr-4">
                <ArrowUpRight className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">GLB Datei hochladen</h3>
                <p className="text-sm text-gray-500">Die gespeicherte Datei vom Server kann nun direkt hochgeladen</p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-2 mr-4">
                <Send className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-medium">Testphase</h3>
                <p className="text-sm text-gray-500">Aktuell befindet sich die Software in der Testphase</p>
                <p className="text-sm text-gray-500"> Sollten Ihnen Fehler auffallen, senden Sie diese gerne an{' '}
                <a href="mailto:info@drohnenvermessung-roofergaming.de" className="text-blue-600 underline">
                  info@drohnenvermessung-roofergaming.de
                </a>
              </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DropZone;
