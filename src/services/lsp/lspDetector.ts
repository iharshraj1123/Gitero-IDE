/**
 * Language Server Detector & Notification Coordinator
 * Detects documents opened without an active or configured LSP server,
 * prompts the user with actionable non-blocking toasts, and handles muting.
 */

import { lspServerRegistry } from './lspServerRegistry';
import { notificationService } from '../notification';
import { preferencesService } from '../preferences';

const IGNORED_EXTENSIONS = new Set([
  'txt',
  'log',
  'md',
  'markdown',
  'csv',
  'tsv',
  'env',
  'gitignore',
  'gitattributes',
  'gitmodules',
  'editorconfig',
  'lock',
  'map',
  'license',
  'ico',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'pdf',
  'zip',
  'tar',
  'gz'
]);

const sessionPromptedLangs = new Set<string>();

export function isLanguageMuted(extOrLang: string): boolean {
  const normalized = extOrLang.toLowerCase().replace(/^\./, '').trim();
  const current = (preferencesService.get('lsp.mutedPrompts') as string[]) || [];
  return current.some((x) => x.toLowerCase() === normalized);
}

export function muteLanguagePrompt(extOrLang: string): void {
  const normalized = extOrLang.toLowerCase().replace(/^\./, '').trim();
  if (!normalized) return;
  const current = (preferencesService.get('lsp.mutedPrompts') as string[]) || [];
  if (!current.some((x) => x.toLowerCase() === normalized)) {
    preferencesService.set('lsp.mutedPrompts', [...current, normalized]);
  }
}

export function unmuteLanguagePrompt(extOrLang: string): void {
  const normalized = extOrLang.toLowerCase().replace(/^\./, '').trim();
  const current = (preferencesService.get('lsp.mutedPrompts') as string[]) || [];
  preferencesService.set('lsp.mutedPrompts', current.filter((x) => x.toLowerCase() !== normalized));
}

export function clearSessionPrompted(): void {
  sessionPromptedLangs.clear();
}

/**
 * Checks if the currently loaded file has LSP support.
 * If not configured and not muted, displays a non-blocking toast.
 */
export function checkMissingLsp(
  filePath: string,
  languageId: string,
  openAddServerModal: (ext: string, langName: string) => void
): void {
  // If LSP is globally disabled in preferences, do not prompt
  if (preferencesService.get('lsp.enabled') === false) {
    return;
  }

  if (!filePath || filePath.startsWith('Untitled-') || filePath.startsWith('gitero://')) {
    return;
  }

  // Extract file extension
  const match = filePath.match(/\.([^.\\/]+)$/);
  const ext = match ? match[1].toLowerCase() : '';

  if (!ext || IGNORED_EXTENSIONS.has(ext)) {
    return;
  }

  // Check if a server config already exists (built-in or user-registered)
  const existingConfig = lspServerRegistry.findConfigForLanguage(languageId) ||
    lspServerRegistry.findConfigForLanguage(ext);

  if (existingConfig) {
    return;
  }

  // Check if muted
  if (isLanguageMuted(ext) || isLanguageMuted(languageId)) {
    return;
  }

  // Check if already prompted in this session
  const sessionKey = `${ext}:${languageId}`.toLowerCase();
  if (sessionPromptedLangs.has(sessionKey)) {
    return;
  }

  sessionPromptedLangs.add(sessionKey);

  const langDisplayName = languageId && languageId !== 'plaintext'
    ? `${languageId.toUpperCase()} (.${ext})`
    : `.${ext}`;

  notificationService.warn(
    'Language Server Not Configured',
    `No language server configured for ${langDisplayName} files. Would you like to configure LSP autocompletion and diagnostics?`,
    [
      {
        label: 'Configure LSP',
        primary: true,
        onClick: () => {
          openAddServerModal(ext, languageId !== 'plaintext' ? languageId : ext);
        }
      },
      {
        label: "Don't Ask Again",
        primary: false,
        onClick: () => {
          muteLanguagePrompt(ext);
          notificationService.info(
            'Preference Saved',
            `Muted LSP notifications for .${ext} files. You can configure language servers anytime in Settings -> Languages & LSP.`,
            undefined,
            4000
          );
        }
      }
    ],
    12000
  );
}
