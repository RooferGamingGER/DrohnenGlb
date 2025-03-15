
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, X, Save } from 'lucide-react';
import { saveScreenshot } from '@/utils/screenshotUtils';
import { useIsMobile } from '@/hooks/use-mobile';

interface ScreenshotDialogProps {
  imageDataUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSave?: (imageDataUrl: string, description: string, filename: string) => void;
}

const ScreenshotDialog: React.FC<ScreenshotDialogProps> = ({ 
  imageDataUrl, 
  open, 
  onClose,
  onSave 
}) => {
  const [description, setDescription] = useState('');
  const timestamp = new Date().getTime();
  const filename = `Aufnahme_${timestamp}`;
  const { isMobile, isTablet, isPortrait } = useIsMobile();

  const handleDownload = () => {
    if (imageDataUrl) {
      const finalFilename = `${filename}${description ? `_${description.replace(/\s+/g, '_')}` : ''}.png`;
      saveScreenshot(imageDataUrl, finalFilename);
    }
  };
  
  const handleSave = () => {
    if (imageDataUrl && onSave) {
      onSave(imageDataUrl, description, filename);
      onClose();
    }
  };

  // Add touch-specific event handlers
  const handleTouchSave = (event: React.TouchEvent) => {
    event.preventDefault();
    handleSave();
  };

  const handleTouchDownload = (event: React.TouchEvent) => {
    event.preventDefault();
    handleDownload();
  };

  if (!imageDataUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aufnahme</DialogTitle>
          <DialogDescription>
            Geben Sie eine Beschreibung für die Aufnahme ein.
            {(isMobile || isTablet) && isPortrait && " (Aufnahme wurde automatisch im Querformat erstellt)"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung (optional)"
              className="col-span-3"
            />
          </div>
          
          <div className="border rounded-md overflow-hidden">
            <img 
              src={imageDataUrl} 
              alt="Aufnahme Vorschau" 
              className="w-full object-contain max-h-64"
            />
          </div>
        </div>
        
        <DialogFooter className="sm:justify-between flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Abbrechen
          </Button>
          
          <div className="flex gap-2">
            {onSave && (
              <Button 
                onClick={handleSave} 
                onTouchStart={handleTouchSave}
                variant="secondary"
                className="touch-manipulation"
              >
                <Save className="mr-2 h-4 w-4" />
                Zur Messung hinzufügen
              </Button>
            )}
            
            <Button 
              onClick={handleDownload}
              onTouchStart={handleTouchDownload}
              className="touch-manipulation"
            >
              <Download className="mr-2 h-4 w-4" />
              Herunterladen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScreenshotDialog;
