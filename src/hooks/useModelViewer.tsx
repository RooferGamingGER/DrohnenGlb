
  const clearMeasurements = () => {
    if (measurementGroupRef.current) {
      console.log("Clearing all measurements");
      
      // First, remove all measurement objects
      measurements.forEach(measurement => {
        if (measurement.labelObject) {
          if (measurement.labelObject.material instanceof THREE.SpriteMaterial) {
            measurement.labelObject.material.map?.dispose();
            measurement.labelObject.material.dispose();
          }
          measurementGroupRef.current?.remove(measurement.labelObject);
        }
        
        if (measurement.lineObjects) {
          measurement.lineObjects.forEach(line => {
            line.geometry.dispose();
            (line.material as THREE.Material).dispose();
            measurementGroupRef.current?.remove(line);
          });
        }
        
        if (measurement.pointObjects) {
          measurement.pointObjects.forEach(point => {
            point.geometry.dispose();
            (point.material as THREE.Material).dispose();
            measurementGroupRef.current?.remove(point);
          });
        }
      });
      
      // Clear all temporary points and lines
      const allTemporaryObjects = measurementGroupRef.current.children.filter(
        child => child.name.startsWith('point-temp-') || 
                child.name.startsWith('line-temp-') || 
                child.name === 'hoverPoint' ||
                child.name === 'preview-area'
      );
      
      allTemporaryObjects.forEach(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
          measurementGroupRef.current?.remove(obj);
        }
      });
      
      // Then remove any remaining objects that might be related to measurements
      const remainingMeasurementObjects = measurementGroupRef.current.children.filter(
        child => child.name.includes('point-') || 
                child.name.includes('line-') || 
                child.name.includes('area-') ||
                child.name.includes('label-')
      );
      
      remainingMeasurementObjects.forEach(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
          measurementGroupRef.current?.remove(obj);
        }
      });
    }
    
    setMeasurements([]);
    setTemporaryPoints([]);
    currentMeasurementRef.current = null;
  };
