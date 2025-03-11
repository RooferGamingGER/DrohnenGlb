
import { useState } from 'react';
import { BackgroundOption } from '@/utils/modelUtils';
import { Check } from 'lucide-react';

interface ControlPanelProps {
  backgroundOptions: BackgroundOption[];
  currentBackground: BackgroundOption;
  onBackgroundChange: (background: BackgroundOption) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  backgroundOptions,
  currentBackground,
  onBackgroundChange,
}) => {
  return (
    <div className="glass mb-4 p-4 rounded-lg shadow-sm">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-sm mb-2">Hintergrund</h3>
          <div className="flex flex-wrap gap-2">
            {backgroundOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => onBackgroundChange(option)}
                className={`relative flex items-center justify-center p-2 h-10 min-w-[80px] rounded border transition-all ${
                  currentBackground.id === option.id
                    ? 'border-primary bg-primary bg-opacity-10'
                    : 'border-border hover:border-primary/50'
                }`}
                aria-label={option.name}
              >
                <span className="text-sm">{option.name}</span>
                {currentBackground.id === option.id && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
