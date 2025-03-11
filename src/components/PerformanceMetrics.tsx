
import React from 'react';
import { Card } from "@/components/ui/card";

interface PerformanceMetricsProps {
  metrics: Record<string, number>;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ metrics }) => {
  if (Object.keys(metrics).length === 0) return null;
  
  return (
    <Card className="mt-4 p-4">
      <h3 className="font-medium mb-2">Performance-Metriken:</h3>
      <div className="space-y-1 text-sm">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span>{key}:</span>
            <span>{value.toFixed(2)} ms</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default PerformanceMetrics;
