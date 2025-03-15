
import { useState, useEffect } from 'react';

interface UseMobileReturn {
  isMobile: boolean;
  isTablet: boolean;
  isPortrait: boolean;
}

export const useIsMobile = (): UseMobileReturn => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile devices based on user agent
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileRegex = /(android|webos|iphone|ipad|ipod|blackberry|windows phone)/i;
      const tabletRegex = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i;
      
      const isMobileDevice = mobileRegex.test(userAgent);
      const isTabletDevice = tabletRegex.test(userAgent) || 
                            (isMobileDevice && window.innerWidth >= 768 && window.innerWidth <= 1024);
      
      // Check orientation
      const orientation = window.innerHeight > window.innerWidth;
      
      setIsMobile(isMobileDevice);
      setIsTablet(isTabletDevice);
      setIsPortrait(orientation);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);

  return { isMobile, isTablet, isPortrait };
};

// Add a new function that returns just a boolean for mobile detection
export const useIsMobileBoolean = (): boolean => {
  const { isMobile } = useIsMobile();
  return isMobile;
};
