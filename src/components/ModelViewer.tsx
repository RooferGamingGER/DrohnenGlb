
  // This function declaration must be inside the ModelViewer component, before any useEffect hooks
  const handleTouchModeChange = useCallback((mode: 'none' | 'pan' | 'rotate' | 'zoom') => {
    console.log(`Touch mode changed to: ${mode}`);
    setTouchMode(mode);

    if (mode === 'zoom') {
      return;
    }
  }, []);
