
import { forwardRef, ReactNode } from 'react';

interface ViewerContainerProps {
  children: ReactNode;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

const ViewerContainer = forwardRef<HTMLDivElement, ViewerContainerProps>(
  ({ children, onDragOver, onDrop }, ref) => {
    return (
      <div 
        ref={ref}
        className="flex-1 relative"
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
