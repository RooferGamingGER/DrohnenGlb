
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileUp } from 'lucide-react';
import { Card } from "@/components/ui/card";
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedFile(file);
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
    <div className="flex h-full w-full bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Informativer Bereich (links) */}
      <div className={`flex-1 flex flex-col justify-center items-center bg-gradient-to-br from-blue-600 to-indigo-700 p-8 ${isPortrait ? 'hidden' : ''}`}>
        <div className="text-center flex flex-col items-center max-w-xl mx-auto">
          <img
            src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
            alt="Drohnenvermessung by RooferGaming"
            className="h-48 mb-6 filter drop-shadow-lg animate-float"
          />
          <h1 className="text-3xl font-bold text-white mb-6 text-balance">
            DrohnenGLB by RooferGaming®
          </h1>
          <p className="text-blue-100 mb-8 text-balance">
            Die präzise Lösung für Ihre Dachvermessung. Nehmen Sie genaue Messungen vor und erstellen Sie detaillierte Berichte direkt auf Ihrem Gerät.
          </p>
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <h3 className="font-semibold text-white mb-2">Präzise Messungen</h3>
              <p className="text-blue-100 text-sm">Exakte Messergebnisse für Ihre Projekte</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <h3 className="font-semibold text-white mb-2">Einfache Bedienung</h3>
              <p className="text-blue-100 text-sm">Intuitive Tools für jeden Anwender</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload-Bereich (rechts) */}
      <div className={`flex flex-col justify-center items-center p-8 ${isPortrait ? 'w-full' : 'flex-1'}`}>
        <Card className="w-full max-w-lg p-8 shadow-xl bg-white/80 backdrop-blur-sm border border-gray-100">
          <div className="text-center md:hidden mb-8">
            <img
              src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
              alt="Drohnenvermessung by RooferGaming"
              className="h-32 mx-auto mb-4"
            />
            <h2 className="text-xl font-bold text-gray-800">DrohnenGLB</h2>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Modell hochladen</h1>
            <p className="text-gray-500 text-sm">
              Laden Sie Ihre GLB-Datei hoch, um sie zu visualisieren
            </p>
          </div>

          <div
            className="border-2 border-dashed border-primary/30 rounded-lg text-center hover:border-primary transition-all w-full p-6 bg-white/5 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:scale-[1.02] transition-all duration-300 flex flex-col items-center justify-center"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <FileUp className="mb-4 text-primary h-10 w-10" />
            <h3 className="font-semibold mb-2 text-xl text-foreground">GLB-Datei hochladen</h3>
            <p className="text-base text-muted-foreground mb-4">
              Ziehen Sie eine Datei hierher oder klicken
            </p>
            <Button
              ref={uploadButtonRef}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-base py-2 px-4 h-auto cursor-pointer touch-manipulation touch-target"
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
