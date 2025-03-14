
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
    <div className="flex flex-col min-h-screen p-2 bg-gradient-to-b from-background to-background/80">
      <div className="flex flex-col md:flex-row w-full max-w-4xl justify-center items-center mx-auto h-full min-h-[70vh] gap-8">
        {/* DropZone window */}
        <div className="w-full md:w-1/2 p-6 flex flex-col items-center justify-center flex-shrink-1 md:p-8 md:max-w-md p-4 max-w-xs fade-in">
          <div
            className="border-2 border-dashed border-primary/30 rounded-lg text-center hover:border-primary transition-all cursor-pointer w-full p-8 bg-white/5 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <FileUp className="mx-auto mb-4 text-primary animate-float md:h-12 md:w-12 h-8 w-8" />
            <h3 className="font-semibold mb-3 text-foreground md:text-xl text-lg">GLB-Datei hochladen</h3>
            <p className="text-muted-foreground mb-6 md:text-sm text-xs max-w-xs mx-auto">
              Ziehen Sie eine Datei hierher oder klicken Sie, um eine Datei auszuwählen.
            </p>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-all duration-200 px-6 py-2 shadow-lg">
              <Upload className="mr-2 md:h-4 md:w-4 h-3 w-3" />
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

        {/* Explanation window */}
        <div className="w-full md:w-1/2 p-6 flex flex-col items-center justify-center flex-shrink-1 md:max-w-md p-3 max-w-xs slide-in">
          <div className="glass rounded-lg w-full p-6 bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
            <h2 className="font-bold mb-5 text-foreground p-2 md:text-2xl text-xl border-b border-primary/20 pb-2">
              Erklärung
            </h2>

            <div className="flex items-start mb-4 p-2 hover:bg-white/5 rounded-lg transition-all">
              <div className="bg-primary/20 rounded-full p-3 mr-4">
                <ArrowDown className="text-primary md:h-5 md:w-5 h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground md:text-lg text-base">
                  Exportieren vom Server
                </h3>
                <p className="text-muted-foreground md:text-sm text-xs">
                  Exportieren Sie die Datei 'Textured Model (glTF)'
                </p>
              </div>
            </div>

            <div className="flex items-start mb-4 p-2 hover:bg-white/5 rounded-lg transition-all">
              <div className="bg-primary/20 rounded-full p-3 mr-4">
                <ArrowUpRight className="text-primary md:h-5 md:w-5 h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground md:text-lg text-base">
                  GLB-Datei hochladen
                </h3>
                <p className="text-muted-foreground md:text-sm text-xs">
                  Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.
                </p>
              </div>
            </div>

            <div className="flex items-start p-2 hover:bg-white/5 rounded-lg transition-all">
              <div className="bg-primary/20 rounded-full p-3 mr-4">
                <Send className="text-primary md:h-5 md:w-5 h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-foreground md:text-lg text-base">
                  Testphase
                </h3>
                <p className="text-muted-foreground mb-1 md:text-sm text-xs mb-2">
                  Die Software befindet sich aktuell in der Testphase.
                </p>
                <p className="text-muted-foreground md:text-sm text-xs">
                  Sollten Ihnen Fehler auffallen, senden Sie diese bitte an{' '}
                  <a 
                    href="mailto:info@drohnenvermessung-roofergaming.de" 
                    className="text-primary hover:text-primary/80 transition-colors underline text-xs md:text-sm"
                  >
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
