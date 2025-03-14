
import { RotateCcw } from 'lucide-react';

const LandscapeWarning = () => {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center">
      <RotateCcw size={48} className="text-primary mb-4 animate-spin-slow" />
      <h2 className="text-xl font-bold mb-2">Bitte Gerät drehen</h2>
      <p className="text-gray-600 mb-6">
        Diese Anwendung kann nur im Querformat genutzt werden.
        Bitte drehen Sie Ihr Gerät.
      </p>
      <div className="w-24 h-36 border-2 border-primary rounded-lg relative mb-4">
        <div className="absolute w-2 h-2 bg-primary rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
          <svg className="w-6 h-6 text-primary animate-bounce" viewBox="0 0 24 24">
            <path fill="currentColor" d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LandscapeWarning;
