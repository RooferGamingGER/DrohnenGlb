import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ onFileSelected, onDragOver, onDrop }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isPortrait } = useIsMobile();

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
    <div className={`flex ${isPortrait ? 'flex-col' : 'flex-row'} w-full h-screen overflow-hidden`}>

      {/* Upload Area - Now on the left or top side */}
      <div className={`${isPortrait ? 'w-full h-1/2' : 'w-1/2 h-full'} flex flex-col items-center justify-center bg-muted/30 overflow-hidden`}>
        <div className="flex-grow flex items-center justify-center">
          <Card className={`w-full max-w-2xl mx-4 p-4 md:p-6 bg-white/10 backdrop-blur-sm border border-muted shadow-xl ${isPortrait ? 'my-2' : ''}`}>
            <div className="text-center mb-3 md:mb-4">
              <h2 className="text-xl md:text-3xl font-bold text-foreground">Modell hochladen</h2>
              <p className="text-md md:text-lg text-muted-foreground mt-1 md:mt-2">
                Laden Sie Ihre GLB-Datei hoch, um sie zu visualisieren
              </p>
            </div>

            <div
              className="border-2 border-dashed border-primary/30 rounded-lg text-center hover:border-primary transition-all cursor-pointer w-full p-4 md:p-6 bg-white/5 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <FileUp className="mb-3 md:mb-4 text-primary h-10 w-10" /> {/* animate-float entfernt */}
              <h3 className="font-semibold mb-2 md:mb-3 text-lg md:text-2xl text-foreground">GLB-Datei hochladen</h3>
              <p className="text-md md:text-lg text-muted-foreground mb-3 md:mb-4">
                Ziehen Sie eine Datei hierher oder klicken
              </p>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-md md:text-lg py-2 px-4 h-auto">
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

      {/* Information Panel - Now on the right or bottom side */}
      <div className={`${isPortrait ? 'w-full h-1/2' : 'w-1/2 h-full'} flex flex-col justify-center bg-primary/10 overflow-hidden`}>
        <div className="max-w-2xl mx-auto p-3 md:p-5 space-y-2 md:space-y-3">
          <h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
            3D-Modell Viewer
          </h1>

          <div className="space-y-2 md:space-y-3">
            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <ArrowDown className="text-primary h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-md md:text-lg text-foreground">
                  Exportieren vom Server
                </h3>
                <p className="text-md md:text-lg text-muted-foreground leading-tight">
                  Gehen Sie zu dem gewünschten Projekt, klicken dann auf  "Dateien herunterladen" und wählen nun das 'Textured Model (glTF)' aus
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <ArrowUpRight className="text-primary h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-md md:text-lg text-foreground">
                  GLB-Datei hochladen
                </h3>
                <p className="text-md md:text-lg text-muted-foreground leading-tight">
                  Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <Send className="text-primary h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-md md:text-lg text-foreground">
                  Testphase
                </h3>
                <p className="text-md md:text-lg text-muted-foreground leading-tight mb-1 md:mb-2">
                  Die Software befindet sich aktuell in der Testphase.
                </p>
                <p className="text-md md:text-lg text-muted-foreground leading-tight">
                  Sollten Ihnen Fehler auffallen, senden Sie diese bitte mit Screenshot, Hinweise oder ähnlichen an{' '}
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

    </div>
  );
};

export default DropZone;
