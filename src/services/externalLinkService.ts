// Gitero IDE External Link Service
// Ensures all external web links (http, https, mailto, etc.) open in the user's OS default browser

import { isNative } from './neutralino';

const EXTERNAL_PROTOCOL_REGEX = /^(https?:\/\/|mailto:|ftp:\/\/|ftps:\/\/|git:\/\/|ssh:\/\/|tel:|\/\/)/i;
const BARE_DOMAIN_REGEX = /^www\.[a-z0-9\-]+(\.[a-z0-9\-]+)+/i;

/**
 * Checks if a given URL or string should be treated as an external link
 * that must be opened in the operating system's default browser.
 */
export function isExternalUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Internal hash anchors, script URLs, and data/blob URLs are not external web links
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return false;
  }

  return EXTERNAL_PROTOCOL_REGEX.test(trimmed) || BARE_DOMAIN_REGEX.test(trimmed);
}

/**
 * Opens an external URL in the OS default browser.
 * Uses Neutralino.os.open() in native desktop runtime, with window.open() fallback in browser mode.
 */
export async function openExternal(url: string): Promise<boolean> {
  if (!url) return false;
  let targetUrl = url.trim();

  // Normalize protocol-relative or bare www domains
  if (targetUrl.startsWith('//')) {
    targetUrl = 'https:' + targetUrl;
  } else if (BARE_DOMAIN_REGEX.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    if (isNative() && window.Neutralino?.os?.open) {
      await window.Neutralino.os.open(targetUrl);
      return true;
    } else {
      const newWin = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return !!newWin;
    }
  } catch (err) {
    console.error('[Gitero IDE] Error opening external link:', targetUrl, err);
    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch {}
    return false;
  }
}

let isHandlerInitialized = false;

/**
 * Installs global event listeners to intercept all external link clicks across the DOM
 * and wraps window.open to prevent navigating the Gitero IDE window away from the editor.
 */
export function initExternalLinkHandler(): void {
  if (isHandlerInitialized) return;
  isHandlerInitialized = true;

  const handleLinkClick = (e: MouseEvent) => {
    // Only intercept primary click (0) and middle click (1)
    if (e.button !== 0 && e.button !== 1) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;

    // Preserve downloads
    if (anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    if (isExternalUrl(href)) {
      e.preventDefault();
      e.stopPropagation();
      openExternal(href);
    }
  };

  // Intercept in capture phase so no child component can inadvertently cause webview navigation
  document.addEventListener('click', handleLinkClick, true);
  document.addEventListener('auxclick', handleLinkClick, true);

  // Wrap window.open to guarantee external URLs route to the OS default browser
  if (typeof window !== 'undefined') {
    const originalWindowOpen = window.open;
    window.open = function (
      url?: string | URL,
      target?: string,
      features?: string
    ): Window | null {
      const urlStr = typeof url === 'string' ? url : url?.toString();
      if (urlStr && isExternalUrl(urlStr)) {
        openExternal(urlStr);
        return null;
      }
      return originalWindowOpen.call(window, url, target, features);
    };
  }

  console.log('[Gitero IDE] External link handler initialized (OS default browser)');
}
