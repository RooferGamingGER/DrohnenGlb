
import { useEffect } from 'react';
import * as THREE from 'three';
import { updateLabelScale } from '@/utils/measurementUtils';

interface UseMeasurementEventsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  modelRef: React.MutableRefObject<THREE.Group | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.MutableRefObject<THREE.OrbitControls | null>;
  measurementGroupRef: React.MutableRefObject<THREE.Group | null>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  mouseRef: React.MutableRefObject<THREE.Vector2>;
  draggedPointRef: React.MutableRefObject<THREE.Mesh | null>;
  activeTool: string;
  isDraggingPoint: boolean;
  selectedMeasurementId: string | null;
  selectedPointIndex: number | null;
  hoveredPointId: string | null;
  setIsDraggingPoint: (value: boolean) => void;
  setHoveredPointId: (value: string | null) => void;
  setSelectedMeasurementId: (value: string | null) => void;
  setSelectedPointIndex: (value: number | null) => void;
  updateMeasurementPointPosition: (id: string, index: number, position: THREE.Vector3) => void;
}

export const useMeasurementEvents = ({
  containerRef,
  modelRef,
  cameraRef,
  controlsRef,
  measurementGroupRef,
  raycasterRef,
  mouseRef,
  draggedPointRef,
  activeTool,
  isDraggingPoint,
  selectedMeasurementId,
  selectedPointIndex,
  hoveredPointId,
  setIsDraggingPoint,
  setHoveredPointId,
  setSelectedMeasurementId,
  setSelectedPointIndex,
  updateMeasurementPointPosition
}: UseMeasurementEventsProps) => {
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleMouseMove = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      
      let clientX: number, clientY: number;
      
      if ('touches' in event) {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
        
        if (isDraggingPoint) {
          event.preventDefault();
        }
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      
      if (isDraggingPoint && draggedPointRef.current && modelRef.current && cameraRef.current) {
        event.preventDefault();
        
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        
        const intersects = raycasterRef.current.intersectObject(modelRef.current, true);
        
        if (intersects.length > 0) {
          const newPosition = intersects[0].point.clone();
          
          draggedPointRef.current.position.copy(newPosition);
          
          if (selectedMeasurementId !== null && selectedPointIndex !== null) {
            updateMeasurementPointPosition(
              selectedMeasurementId, 
              selectedPointIndex, 
              newPosition
            );
          }
        }
      }
      else if (activeTool === 'move' && measurementGroupRef.current && cameraRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        
        const pointObjects = measurementGroupRef.current.children.filter(
          child => child instanceof THREE.Mesh && child.name.startsWith('point-')
        );
        
        const intersects = raycasterRef.current.intersectObjects(pointObjects, false);
        
        if (intersects.length > 0) {
          const pointId = intersects[0].object.name;
          setHoveredPointId(pointId);
          document.body.style.cursor = 'grab';
        } else {
          if (hoveredPointId) {
            setHoveredPointId(null);
          }
          document.body.style.cursor = 'auto';
        }
      }
    };

    const handleMouseDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current || !measurementGroupRef.current) return;
      
      if ('touches' in event && event.touches.length > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
        
        if (activeTool === 'move' || hoveredPointId) {
          event.preventDefault();
        }
      }
      
      if (hoveredPointId && activeTool === 'move') {
        event.stopPropagation();
        event.preventDefault();
        
        const pointMesh = measurementGroupRef.current.children.find(
          child => child.name === hoveredPointId
        ) as THREE.Mesh;
        
        if (pointMesh) {
          setIsDraggingPoint(true);
          draggedPointRef.current = pointMesh;
          document.body.style.cursor = 'grabbing';
          
          const nameParts = hoveredPointId.split('-');
          if (nameParts.length >= 3) {
            const measurementId = nameParts[1];
            const pointIndex = parseInt(nameParts[2], 10);
            
            setSelectedMeasurementId(measurementId);
            setSelectedPointIndex(pointIndex);
            
            if (controlsRef.current) {
              controlsRef.current.enabled = false;
            }
          }
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingPoint) {
        setIsDraggingPoint(false);
        draggedPointRef.current = null;
        document.body.style.cursor = hoveredPointId ? 'grab' : 'auto';
        
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
        
        setSelectedMeasurementId(null);
        setSelectedPointIndex(null);
      }
    };

    containerRef.current.addEventListener('mousedown', handleMouseDown, { capture: true });
    containerRef.current.addEventListener('touchstart', handleMouseDown, { passive: false, capture: true });
    
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousedown', handleMouseDown, { capture: true });
        containerRef.current.removeEventListener('touchstart', handleMouseDown, { capture: true });
      }
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
    };
  }, [
    containerRef,
    modelRef,
    cameraRef,
    measurementGroupRef,
    activeTool,
    isDraggingPoint,
    hoveredPointId,
    selectedMeasurementId,
    selectedPointIndex,
    updateMeasurementPointPosition
  ]);

  return {};
};
