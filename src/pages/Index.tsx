
import React from 'react';
import ModelViewer from '@/components/ModelViewer';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user } = useAuth();
  
  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      <div className="p-4 mb-2">
        <h1 className="text-2xl font-bold">DrohnenGLB Viewer</h1>
        {user && <p className="text-sm text-muted-foreground">Eingeloggt als: {user.email}</p>}
      </div>
      <div className="h-[calc(100%-5rem)]">
        <ModelViewer />
      </div>
    </div>
  );
};

export default Index;
