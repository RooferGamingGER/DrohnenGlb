
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
    <div className="flex items-center gap-2">
      <span className="text-xs whitespace-nowrap">Hintergrund:</span>
      <div className="flex flex-wrap gap-1">
        {backgroundOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onBackgroundChange(option)}
            className={`relative flex items-center justify-center p-1 h-8 min-w-[60px] rounded border transition-all ${
              currentBackground.id === option.id
                ? 'border-primary bg-primary bg-opacity-10'
                : 'border-border hover:border-primary/50'
            }`}
            aria-label={option.name}
          >
            <span className="text-xs">{option.name}</span>
            {currentBackground.id === option.id && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-2 h-2 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ControlPanel;
