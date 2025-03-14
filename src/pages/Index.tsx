
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileUp, ArrowDown, ArrowUpRight, Send } from 'lucide-react';
import UploadArea from '@/components/UploadArea';
import ModelViewer from '@/components/ModelViewer';
import { Card } from '@/components/ui/card';

const Index = () => {
  const { isPortrait } = useIsMobile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    
    // Simulate upload progress
    setUploadProgress(0);
    const timer = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsLoading(false);
          return 100;
        }
        return prev + 5;
      });
    }, 300);
  };

  // If a file is already selected and loaded, show the model viewer
  if (selectedFile && !isLoading && uploadProgress >= 100) {
    return (
      <div className="h-screen w-full overflow-hidden bg-gradient-to-b from-background to-background/80 relative">
        <div className="block h-full">
          <ModelViewer forceHideHeader={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Left panel with instructions - similar to login page left side */}
      <div className="hidden md:flex md:flex-col md:justify-center md:items-center md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-8">
        <div className="text-center flex flex-col items-center max-w-md">
          <img
            src="/lovable-uploads/ae57186e-1cff-456d-9cc5-c34295a53942.png"
            alt="Drohnenvermessung by RooferGaming"
            className="h-48 mb-4 filter drop-shadow-lg animate-float"
          />
          <h1 className="text-3xl font-bold text-white mb-4 text-balance">
            DrohnenGLB by RooferGaming®
          </h1>
          <p className="text-blue-100 mb-8 text-balance">
            Laden Sie Ihre GLB-Dateien hoch und visualisieren Sie Ihre 3D-Modelle direkt im Browser.
          </p>
          
          <div className="w-full space-y-4">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <div className="flex items-start">
                <div className="bg-white/20 rounded-full p-3 mr-4">
                  <ArrowDown className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white mb-1">Exportieren vom Server</h3>
                  <p className="text-blue-100 text-sm">
                    Exportieren Sie die Datei 'Textured Model (glTF)'
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <div className="flex items-start">
                <div className="bg-white/20 rounded-full p-3 mr-4">
                  <ArrowUpRight className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white mb-1">GLB-Datei hochladen</h3>
                  <p className="text-blue-100 text-sm">
                    Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg border border-white/20">
              <div className="flex items-start">
                <div className="bg-white/20 rounded-full p-3 mr-4">
                  <Send className="text-white h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white mb-1">Testphase</h3>
                  <p className="text-blue-100 text-sm mb-2">
                    Die Software befindet sich aktuell in der Testphase.
                  </p>
                  <p className="text-blue-100 text-xs">
                    Sollten Ihnen Fehler auffallen, senden Sie diese bitte an{' '}
                    <a 
                      href="mailto:info@drohnenvermessung-roofergaming.de" 
                      className="text-white hover:text-blue-200 transition-colors underline"
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
      
      {/* Right panel with upload functionality - similar to login page right side */}
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 p-4">
        <Card className="w-full max-w-md p-8 shadow-xl bg-white/80 backdrop-blur-sm border border-gray-100">
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
          
          <div className="space-y-6">
            <UploadArea 
              onFileSelected={handleFileSelected} 
              isLoading={isLoading} 
              progress={uploadProgress} 
            />
            
            {/* Mobile-only instructions */}
            <div className="md:hidden space-y-4 mt-8 border-t pt-6">
              <h3 className="font-medium text-gray-800 mb-2">Anleitung:</h3>
              
              <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <ArrowDown className="text-blue-600 h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 text-sm">Exportieren vom Server</h4>
                  <p className="text-gray-500 text-xs">Exportieren Sie die Datei 'Textured Model (glTF)'</p>
                </div>
              </div>
              
              <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <ArrowUpRight className="text-blue-600 h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 text-sm">GLB-Datei hochladen</h4>
                  <p className="text-gray-500 text-xs">Die gespeicherte Datei vom Server kann nun direkt hochgeladen werden.</p>
                </div>
              </div>
              
              <div className="flex items-start p-3 bg-gray-50 rounded-lg">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <Send className="text-blue-600 h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800 text-sm">Testphase</h4>
                  <p className="text-gray-500 text-xs">
                    Die Software befindet sich aktuell in der Testphase.
                    Sollten Ihnen Fehler auffallen, senden Sie diese bitte an{' '}
                    <a 
                      href="mailto:info@drohnenvermessung-roofergaming.de" 
                      className="text-blue-600 hover:text-blue-800 transition-colors underline text-xs"
                    >
                      info@drohnenvermessung-roofergaming.de
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        <p className="text-xs text-gray-500 mt-8 text-center">
          © 2023 RooferGaming® | Alle Rechte vorbehalten
        </p>
      </div>
    </div>
  );
};

export default Index;
