import React, { useRef, useEffect } from 'react';
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
    <div className="flex min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Informativer Bereich (links/oben) */}
      <div className={`w-1/4 bg-gradient-to-br from-blue-600 to-indigo-700 p-4 ${isPortrait ? 'w-full' : 'hidden md:block'}`}>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">
            3D-Modell Viewer
          </h1>
          <p className="text-blue-100 text-sm">
            Laden Sie Ihre GLB-Datei hoch, um sie zu visualisieren.
          </p>
        </div>
      </div>

      {/* Interaktiver Bereich (rechts/unten) */}
      <div className={`flex-1 flex flex-col justify-center items-center p-4 ${isPortrait ? 'w-full' : ''}`}>
        <Card className="w-full max-w-md p-8 shadow-xl bg-white/80 backdrop-blur-sm border border-gray-100">
          <div className="text-center md:hidden mb-8">
            <h2 className="text-xl font-bold text-gray-800">3D-Modell Viewer</h2>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Modell hochladen</h1>
            <p className="text-gray-500 text-sm">
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

        <p className="text-xs text-gray-500 mt-8 text-center">
          © 2023 RooferGaming® | Alle Rechte vorbehalten
        </p>
      </div>
    </div>
  );
};

export default DropZone;
