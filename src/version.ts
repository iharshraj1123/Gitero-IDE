declare const __APP_VERSION__: string;
declare const __GIT_COMMIT_SHA__: string;
declare const __GIT_BRANCH__: string;

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
  ((typeof window !== 'undefined' && (window as any).NL_APPVERSION) ? (window as any).NL_APPVERSION : '0.2.9-beta');

/**
 * Formatted display version (e.g. "v0.2.9-beta").
 */
export const DISPLAY_VERSION: string = APP_VERSION.startsWith('v') ? APP_VERSION : `v${APP_VERSION}`;

/**
 * Git commit SHA at build time (e.g. "d4d39d5").
 */
export const GIT_COMMIT_SHA: string =
  (typeof __GIT_COMMIT_SHA__ !== 'undefined' && __GIT_COMMIT_SHA__) || 'HEAD';

/**
 * Git branch name at build time (e.g. "main").
 */
export const GIT_BRANCH: string =
  (typeof __GIT_BRANCH__ !== 'undefined' && __GIT_BRANCH__) || 'main';
