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
    <div className="fixed inset-0 flex items-center justify-center bg-gray-100"> {/* Hintergrundfarbe */}
      <div className="flex flex-col md:flex-row w-full max-w-3xl p-6 rounded-xl shadow-lg bg-white"> {/* Größere Breite, Abstand, abgerundete Ecken und Schatten */}
        {/* DropZone-Fenster */}
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-center mt-16 md:mt-0"> {/* Größerer Abstand */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer" // Hover-Effekt
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-12 w-12 mx-auto mb-6 text-gray-500" />
            <h3 className="text-2xl font-semibold mb-4 text-gray-800">GLB-Datei hochladen</h3>
            <p className="text-lg text-gray-600 mb-8">Wählen Sie eine GLB-Datei zum Hochladen aus.</p>
            <Button className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"> {/* Button-Styling */}
              <Upload className="mr-2 h-5 w-5" />
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
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-center"> {/* Größerer Abstand */}
          <div className="bg-white rounded-xl p-8 shadow-md"> {/* Abgerundete Ecken und Schatten */}
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Erklärung</h2>

            <div className="flex items-center mb-6">
              <div className="bg-blue-100 rounded-full p-3 mr-4">
                <ArrowDown className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-800">Exportieren vom Server</h3>
                <p className="text-gray-600">Exportieren Sie die Datei 'Textured Model (glTF)'</p>
              </div>
            </div>

            <div className="flex items-center mb-6">
              <div className="bg-blue-100 rounded-full p-3 mr-4">
                <ArrowUpRight className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-800">GLB-Datei hochladen</h3>
                <p className="text-gray-600">Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.</p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="bg-blue-100 rounded-full p-3 mr-4">
                <Send className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-800">Testphase</h3>
                <p className="text-gray-600 mb-2">Die Software befindet sich aktuell in der Testphase.</p>
                <p className="text-gray-600">
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
