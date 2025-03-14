import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

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
      <div className="flex flex-col md:flex-row w-full max-w-4xl justify-center mx-auto">
        {/* DropZone-Fenster */}
        <div className={twMerge(
          "w-full md:w-1/2 p-6 flex flex-col items-center flex-shrink-1",
          "md:p-8 md:max-w-md", // Desktop Anpassungen
          "p-4 max-w-xs"          // Mobile Anpassungen
        )}>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-500 transition-colors cursor-pointer w-full"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <FileUp className={twMerge(
              "mx-auto mb-3 text-gray-500",
              "md:h-8 md:w-8", // Desktop Anpassungen
              "h-5 w-5"        // Mobile Anpassungen
            )} />
            <h3 className={twMerge(
              "font-semibold mb-2 text-gray-800",
              "md:text-lg", // Desktop Anpassungen
              "text-sm"        // Mobile Anpassungen
            )}>GLB-Datei hochladen</h3>
            <p className={twMerge(
              "text-gray-600 mb-4",
              "md:text-sm", // Desktop Anpassungen
              "text-xs mb-3"  // Mobile Anpassungen
            )}>Wählen Sie eine GLB-Datei zum Hochladen aus.</p>
            <Button className={twMerge(
              "bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors",
              "md:px-6 md:py-2 md:text-sm", // Desktop Anpassungen
              "px-3 py-1 text-xs"            // Mobile Anpassungen
            )}>
              <Upload className={twMerge(
                "mr-2",
                "md:h-4 md:w-4", // Desktop Anpassungen
                "h-3 w-3"        // Mobile Anpassungen
              )} />
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
        <div className={twMerge(
          "w-full md:w-1/2 p-6 flex flex-col items-center flex-shrink-1",
          "md:max-w-md", // Desktop Anpassungen
          "p-3 max-w-xs" // Mobile Anpassungen
        )}>
          <div className="bg-white rounded-lg w-full">
            <h2 className={twMerge(
              "font-bold mb-3 text-gray-800 p-2",
              "md:text-xl", // Desktop Anpassungen
              "text-md"        // Mobile Anpassungen
            )}>Erklärung</h2>

            <div className="flex items-start mb-3 p-2">
              <div className="bg-blue-100 rounded-full p-2 mr-2">
                <ArrowDown className={twMerge(
                  "text-blue-500",
                  "md:h-4 md:w-4", // Desktop Anpassungen
                  "h-3 w-3"        // Mobile Anpassungen
                )} />
              </div>
              <div>
                <h3 className={twMerge(
                  "font-semibold mb-1 text-gray-800",
                  "md:text-md", // Desktop Anpassungen
                  "text-xs"        // Mobile Anpassungen
                )}>Exportieren vom Server</h3>
                <p className={twMerge(
                  "text-gray-600",
                  "md:text-sm", // Desktop Anpassungen
                  "text-xs"        // Mobile Anpassungen
                )}>Exportieren Sie die Datei 'Textured Model (glTF)'</p>
              </div>
            </div>

            <div className="flex items-start mb-3 p-2">
              <div className="bg-blue-100 rounded-full p-2 mr-2">
                <ArrowUpRight className={twMerge(
                  "text-blue-500",
                  "md:h-4 md:w-4", // Desktop Anpassungen
                  "h-3 w-3"        // Mobile Anpassungen
                )} />
              </div>
              <div>
                <h3 className={twMerge(
                  "font-semibold mb-1 text-gray-800",
                  "md:text-md", // Desktop Anpassungen
                  "text-xs"        // Mobile Anpassungen
                )}>GLB-Datei hochladen</h3>
                <p className={twMerge(
                  "text-gray-600",
                  "md:text-sm", // Desktop Anpassungen
                  "text-xs"        // Mobile Anpassungen
                )}>Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.</p>
              </div>
            </div>

            <div className="flex items-start p-2">
              <div className="bg-blue-100 rounded-full p-2 mr-2">
                <Send className={twMerge(
                  "text-blue-500",
                  "md:h-4 md:w-4", // Desktop Anpassungen
                  "h-3 w-3"        // Mobile Anpassungen
                )} />
              </div>
              <div>
                <h3 className={twMerge(
                  "font-semibold mb-1 text-gray-800",
                  "md:text-md", // Desktop Anpassungen
                  "text-xs"        // Mobile Anpassungen
                )}>Testphase</h3>
                <p className={twMerge(
                  "text-gray-600 mb-1",
                  "md:text-sm", // Desktop Anpassungen
                  "text-xs mb-0"   // Mobile Anpassungen
                )}>Die Software befindet sich aktuell in der Testphase.</p>
                <p className={twMerge(
                  "text-gray-600",
                  "md:text-sm",    // Desktop Anpassungen
                  "text-xs"
                )}>
                  Sollten Ihnen Fehler auffallen, senden Sie diese bitte an{' '}
                  <a href="mailto:info@drohnenvermessung-roofergaming.de" className="text-blue-600 underline text-xs md:text-sm">
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
