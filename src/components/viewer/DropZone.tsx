
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';

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
    <div className="flex flex-col md:flex-row w-full h-full">
      {/* Left Side - Information in Blue */}
      <div className="w-full md:w-1/2 flex flex-col justify-center h-full bg-primary/10">
        <div className="max-w-md mx-auto p-4 md:p-6 space-y-4 md:space-y-5">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            3D-Modell Viewer
          </h1>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <ArrowDown className="text-primary h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  Exportieren vom Server
                </h3>
                <p className="text-muted-foreground text-xs md:text-sm">
                  Exportieren Sie die Datei 'Textured Model (glTF)'
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <ArrowUpRight className="text-primary h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  GLB-Datei hochladen
                </h3>
                <p className="text-muted-foreground text-xs md:text-sm">
                  Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <Send className="text-primary h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  Testphase
                </h3>
                <p className="text-muted-foreground text-xs md:text-sm mb-1">
                  Die Software befindet sich aktuell in der Testphase.
                </p>
                <p className="text-muted-foreground text-xs md:text-sm">
                  Sollten Ihnen Fehler auffallen, senden Sie diese bitte an{' '}
                  <a 
                    href="mailto:info@drohnenvermessung-roofergaming.de" 
                    className="text-primary hover:text-primary/80 transition-colors underline"
                  >
                    info@drohnenvermessung-roofergaming.de
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Side - Upload Area */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center bg-muted/30 h-full">
        <Card className="w-full max-w-md mx-4 p-5 bg-white/10 backdrop-blur-sm border border-muted shadow-xl">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-foreground">Modell hochladen</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Laden Sie Ihre GLB-Datei hoch, um sie zu visualisieren
            </p>
          </div>
          
          <div
            className="border-2 border-dashed border-primary/30 rounded-lg text-center hover:border-primary transition-all cursor-pointer w-full p-4 md:p-6 bg-white/5 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <FileUp className="mb-3 text-primary animate-float h-10 w-10" />
            <h3 className="font-semibold mb-2 text-foreground">GLB-Datei hochladen</h3>
            <p className="text-muted-foreground mb-3 text-xs md:text-sm">
              Ziehen Sie eine Datei hierher oder klicken
            </p>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <UploadCloud className="mr-2 h-4 w-4" />
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
        </Card>
      </div>
    </div>
  );
};

export default DropZone;
