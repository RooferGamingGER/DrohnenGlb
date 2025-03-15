import * as THREE from 'three';
import type { Measurement, MeasurementPoint } from '@/hooks/useModelViewer';

export function highlightMeasurementPoints(measurement: Measurement, parentGroup: THREE.Group, highlight: boolean): void {
  measurement.points.forEach((point, index) => {
    const pointName = `point-${measurement.id}-${index}`;
    const pointMesh = parentGroup.getObjectByName(pointName) as THREE.Mesh;
    
    if (pointMesh && pointMesh.material instanceof THREE.PointsMaterial) {
      (pointMesh.material as THREE.PointsMaterial).color.set(highlight ? 0xff0000 : 0x00ff00);
      (pointMesh.material as THREE.PointsMaterial).size = highlight ? 0.12 : 0.08;
    }
  });
}

export function updateMeasurementGeometry(measurement: Measurement): void {
  if (!measurement.line) return;
  
  const positions = [];
  for (const point of measurement.points) {
    positions.push(point.worldPosition.x, point.worldPosition.y, point.worldPosition.z);
  }
  
  const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
  measurement.line.geometry.setAttribute('position', positionAttribute);
  measurement.line.geometry.computeBoundingSphere();
  measurement.line.geometry.attributes.position.needsUpdate = true;
}

// Improved findNearestEditablePoint function with better touch support
export function findNearestEditablePoint(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  mousePosition: THREE.Vector2,
  parentGroup: THREE.Group,
  threshold: number = 0.2
): THREE.Mesh | null {
  // Find mesh points that are in edit mode
  const editablePoints: THREE.Mesh[] = [];
  
  parentGroup.traverse((child) => {
    if (
      child instanceof THREE.Mesh && 
      child.name.startsWith('point-') && 
      child.visible
    ) {
      // Check if the measurement this point belongs to is in edit mode
      const nameParts = child.name.split('-');
      if (nameParts.length >= 3) {
        const measurementId = nameParts[1];
        const measurementGroup = parentGroup.children.find(
          group => group instanceof THREE.Group && group.name === `measurement-${measurementId}`
        );
        
        if (measurementGroup && (measurementGroup as any).userData.editMode) {
          editablePoints.push(child);
        }
      }
    }
  });
  
  if (editablePoints.length === 0) return null;
  
  // Use raycasting for direct hit detection first (more accurate)
  const intersects = raycaster.intersectObjects(editablePoints, false);
  if (intersects.length > 0) {
    return intersects[0].object as THREE.Mesh;
  }
  
  // If no direct hit, use proximity based detection
  // This is especially helpful for touch where precise tapping is difficult
  let closestPoint: THREE.Mesh | null = null;
  let closestDistance = Infinity;
  
  // Screen space distance calculation works better for touch
  editablePoints.forEach(point => {
    // Get the point position in screen space
    const screenPosition = new THREE.Vector3();
    screenPosition.copy(point.position);
    screenPosition.project(camera);
    
    // Calculate screen space distance
    const distance = mousePosition.distanceTo(
      new THREE.Vector2(screenPosition.x, screenPosition.y)
    );
    
    if (distance < closestDistance && distance < threshold) {
      closestDistance = distance;
      closestPoint = point;
    }
  });
  
  return closestPoint;
}

// Enhanced updateCursorForDraggablePoint for better touch feedback
export function updateCursorForDraggablePoint(isDraggable: boolean): void {
  if (isDraggable) {
    document.body.style.cursor = 'grab';
    
    // On mobile, make point handling more obvious with color changes
    // This is executed only in browser context
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // Mobile devices don't show cursor changes, so we rely on color
      const activePoints = document.querySelectorAll('[data-point-active="true"]');
      activePoints.forEach((point) => {
        if (point instanceof HTMLElement) {
          point.style.transform = 'scale(1.5)';
        }
      });
    }
  } else {
    document.body.style.cursor = 'auto';
    
    // Reset any visual changes we made
    const activePoints = document.querySelectorAll('[data-point-active="true"]');
    activePoints.forEach((point) => {
      if (point instanceof HTMLElement) {
        point.style.transform = '';
      }
    });
  }
}
