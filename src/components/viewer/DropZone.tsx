import { useRef, useEffect } from 'react';
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
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
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

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  useEffect(() => {
    const uploadButton = uploadButtonRef.current;

    if (uploadButton) {
      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
      };

      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();

        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }, 10);
      };

      uploadButton.addEventListener('touchstart', handleTouchStart, { passive: false });
      uploadButton.addEventListener('touchend', handleTouchEnd, { passive: false });

      return () => {
        uploadButton.removeEventListener('touchstart', handleTouchStart);
        uploadButton.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, []);

  return (
    <div className={`flex ${isPortrait ? 'flex-col' : 'flex-row'} w-full h-screen`}>
      {/* Upload Area */}
      <div className={`${isPortrait ? 'h-1/2' : 'w-1/2'} flex items-center justify-center bg-muted/30 p-4`}>
        <Card className="w-full max-w-xl bg-white/10 backdrop-blur-sm border border-muted shadow-xl p-4 md:p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Modell hochladen</h2>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Laden Sie Ihre GLB-Datei hoch, um sie zu visualisieren
            </p>
          </div>

          <div
            className="border-2 border-dashed border-primary/30 rounded-lg text-center hover:border-primary transition-all w-full p-4 md:p-6 bg-white/5 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <FileUp className="mb-3 md:mb-4 text-primary h-8 w-8 md:h-10 md:w-10" />
            <h3 className="font-semibold mb-2 text-base md:text-xl text-foreground">GLB-Datei hochladen</h3>
            <p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4">
              Ziehen Sie eine Datei hierher oder klicken
            </p>
            <Button
              ref={uploadButtonRef}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm md:text-base py-2 px-4 h-auto cursor-pointer touch-manipulation touch-target"
              onClick={handleButtonClick}
              type="button"
              aria-label="Datei auswählen"
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Datei auswählen
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb"
              className="hidden"
              onChange={handleFileChange}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </Card>
      </div>

      {/* Information Panel */}
      <div className={`${isPortrait ? 'h-1/2' : 'w-1/2'} flex items-center justify-center bg-primary/10 p-4`}>
        <div className="w-full max-w-xl mx-auto p-3 md:p-5 space-y-2 md:space-y-3">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            3D-Modell Viewer
          </h1>

          <div className="space-y-2 md:space-y-3">
            <div className="flex items-start">
              <div className="bg-primary/20 rounded-full p-2 mr-3 flex-shrink-0">
                <ArrowDown className="text-primary h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm md:text-base text-foreground">
                  Exportieren vom Server
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">
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
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">
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
                <p className="text-xs md:text-sm text-muted-foreground leading-tight mb-1">
                  Die Software befindet sich aktuell in der Testphase.
                </p>
                <p className="text-xs md:text-sm text-muted-foreground leading-tight">
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
    </div>
  );
};

export default DropZone;
