declare const __APP_VERSION__: string;

/**
 * Gitero IDE Application Version.
 *
 * Automatically resolved:
 * 1. Replaced at build/dev time by Vite from package.json via __APP_VERSION__.
 * 2. Fallback to Neutralino runtime global window.NL_APPVERSION (from neutralino.config.json).
 * 3. Static fallback default.
 */
export const APP_VERSION: string =
  (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ||
  ((typeof window !== 'undefined' && (window as any).NL_APPVERSION) ? (window as any).NL_APPVERSION : '0.1.2-beta');

/**
 * Formatted display version (e.g. "v0.1.2-beta").
 */
export const DISPLAY_VERSION: string = APP_VERSION.startsWith('v') ? APP_VERSION : `v${APP_VERSION}`;
