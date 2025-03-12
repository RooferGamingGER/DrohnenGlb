
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
import { Download, FileDown, X, Save } from 'lucide-react';
import { saveScreenshot } from '@/utils/screenshotUtils';

interface ScreenshotDialogProps {
  imageDataUrl: string | null;
  open: boolean;
  onClose: () => void;
  onSave?: (imageDataUrl: string, description: string) => void;
}

const ScreenshotDialog: React.FC<ScreenshotDialogProps> = ({ 
  imageDataUrl, 
  open, 
  onClose,
  onSave 
}) => {
  const [filename, setFilename] = useState('screenshot');
  const [description, setDescription] = useState('');

  const handleDownload = () => {
    if (imageDataUrl) {
      const finalFilename = `${filename || 'screenshot'}${description ? `_${description.replace(/\s+/g, '_')}` : ''}.png`;
      saveScreenshot(imageDataUrl, finalFilename);
    }
  };
  
  const handleSave = () => {
    if (imageDataUrl && onSave) {
      onSave(imageDataUrl, description);
      onClose();
    }
  };

  if (!imageDataUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Screenshot</DialogTitle>
          <DialogDescription>
            Geben Sie einen Namen und eine Beschreibung für den Screenshot ein.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="filename">Dateiname</Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="screenshot"
              className="col-span-3"
            />
          </div>
          
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
              alt="Screenshot Vorschau" 
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
              <Button onClick={handleSave} variant="secondary">
                <Save className="mr-2 h-4 w-4" />
                Zur Messung hinzufügen
              </Button>
            )}
            
            <Button onClick={handleDownload}>
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
