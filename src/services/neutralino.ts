// Safe Neutralino API wrapper with browser fallback support
declare global {
  interface Window {
    Neutralino?: any;
  }
}

let isInitialized = false;

export async function initNeutralino(): Promise<boolean> {
  if (isInitialized) return true;
  
  if (typeof window !== 'undefined' && window.Neutralino) {
    try {
      window.Neutralino.init();
      
      // Register window close event
      window.Neutralino.events.on('windowClose', () => {
        window.Neutralino.app.exit();
      });

      isInitialized = true;
      console.log('[Gitero IDE] Native Neutralino engine initialized');
      return true;
    } catch (err) {
      console.warn('[Gitero IDE] Neutralino init error, running in web fallback mode:', err);
      return false;
    }
  }

  console.info('[Gitero IDE] Neutralino not present, running in web fallback mode');
  return false;
}

export function isNative(): boolean {
  return typeof window !== 'undefined' && !!window.Neutralino && isInitialized;
}
