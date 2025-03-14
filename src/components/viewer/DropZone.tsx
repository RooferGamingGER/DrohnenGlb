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
    <div className="flex flex-col min-h-screen p-2">
      {/* Hauptinhalt (DropZone und "How It Works") */}
      <div className="flex flex-col md:flex-row w-full max-w-lg items-start md:items-center justify-center"> {/* Zentrierung und vertikale Ausrichtung angepasst */}
        {/* DropZone-Fenster */}
        <div className="w-full md:w-1/2 p-3 flex flex-col items-center flex-shrink-1">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors cursor-pointer w-full max-w-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-5 w-5 mx-auto mb-2 text-gray-500" />
            <h3 className="text-sm font-semibold mb-1 text-gray-800">GLB-Datei hochladen</h3>
            <p className="text-xs text-gray-600 mb-3">Wählen Sie eine GLB-Datei zum Hochladen aus.</p>
            <Button className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors text-xs">
              <Upload className="mr-1 h-3 w-3" />
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
        <div className="w-full md:w-1/2 p-3 flex flex-col items-center flex-shrink-1">
          <div className="bg-white rounded-lg p-3 max-w-xs w-full">
            <h2 className="text-md font-bold mb-2 text-gray-800">Erklärung</h2>

            <div className="flex items-start mb-2">
              <div className="bg-blue-100 rounded-full p-1 mr-1">
                <ArrowDown className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xs font-semibold mb-0 text-gray-800">Exportieren vom Server</h3>
                <p className="text-xs text-gray-600">Exportieren Sie die Datei 'Textured Model (glTF)'</p>
              </div>
            </div>

            <div className="flex items-start mb-2">
              <div className="bg-blue-100 rounded-full p-1 mr-1">
                <ArrowUpRight className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xs font-semibold mb-0 text-gray-800">GLB-Datei hochladen</h3>
                <p className="text-xs text-gray-600">Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.</p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-blue-100 rounded-full p-1 mr-1">
                <Send className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xs font-semibold mb-0 text-gray-800">Testphase</h3>
                <p className="text-xs text-gray-600 mb-0">Die Software befindet sich aktuell in der Testphase.</p>
                <p className="text-xs text-gray-600">
                  Sollten Ihnen Fehler auffallen, senden Sie diese bitte an{' '}
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
