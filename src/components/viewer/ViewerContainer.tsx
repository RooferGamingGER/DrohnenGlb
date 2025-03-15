
import { forwardRef, ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ViewerContainerProps {
  children: ReactNode;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

const ViewerContainer = forwardRef<HTMLDivElement, ViewerContainerProps>(
  ({ children, onDragOver, onDrop }, ref) => {
    const { isPortrait } = useIsMobile();
    
    return (
      <div 
        ref={ref}
        className={`relative ${isPortrait ? 'h-full w-full' : 'flex-1 flex items-center justify-center'}`}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {children}
      </div>
    );
  }
);

ViewerContainer.displayName = 'ViewerContainer';

export default ViewerContainer;
