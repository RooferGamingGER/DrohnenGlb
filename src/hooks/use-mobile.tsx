
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  const [isPortrait, setIsPortrait] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth)
    }
    
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      checkOrientation()
    }
    
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    checkOrientation()
    
    window.addEventListener("resize", checkOrientation)
    window.addEventListener("orientationchange", checkOrientation)
    
    return () => {
      mql.removeEventListener("change", onChange)
      window.removeEventListener("resize", checkOrientation)
      window.removeEventListener("orientationchange", checkOrientation)
    }
  }, [])

  // Return both the object with properties and a boolean for backward compatibility
  return {
    isMobile: !!isMobile,
    isPortrait: !!isPortrait,
    // For backward compatibility with code expecting a boolean directly
    [Symbol.toPrimitive](hint: string) {
      return hint === 'boolean' ? !!isMobile : undefined;
    }
  }
}

// Add a convenience hook for when only the boolean is needed
export function useIsMobileBoolean(): boolean {
  const mobileState = useIsMobile();
  return mobileState.isMobile;
}
