/**
 * Language Server Detector & Notification Coordinator
 * Detects documents opened without an active or configured LSP server,
 * prompts the user with actionable non-blocking toasts, and handles muting.
 */

import { lspServerRegistry } from './lspServerRegistry';
import { lspInstaller } from './lspInstaller';
import { notificationService } from '../notification';
import { preferencesService } from '../preferences';

declare const window: any;

const IGNORED_EXTENSIONS = new Set([
  // Text, documentation & markdown
  'txt',
  'text',
  'log',
  'md',
  'markdown',
  'rst',
  'adoc',
  'asciidoc',
  // Windows shell, shortcuts & registry
  'bat',
  'cmd',
  'url',
  'lnk',
  'reg',
  'vbs',
  // Tabular data
  'csv',
  'tsv',
  'tab',
  // Configuration & settings
  'ini',
  'conf',
  'cfg',
  'properties',
  'toml',
  'inf',
  'plist',
  // Environment & version control metadata
  'env',
  'gitignore',
  'gitattributes',
  'gitmodules',
  'editorconfig',
  'npmrc',
  'prettierrc',
  'dockerignore',
  'eslintignore',
  // Lockfiles, maps, checksums & temp
  'lock',
  'map',
  'sha1',
  'sha256',
  'md5',
  'bak',
  'tmp',
  'temp',
  'swp',
  // Legal & project notes
  'license',
  'authors',
  'changelog',
  'readme',
  'notice',
  // Images & graphics
  'ico',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'tiff',
  'psd',
  'ai',
  'eps',
  // Audio & video
  'mp3',
  'wav',
  'ogg',
  'flac',
  'mp4',
  'webm',
  'mkv',
  'avi',
  'mov',
  // Documents & archives
  'pdf',
  'zip',
  'tar',
  'gz',
  '7z',
  'rar',
  'bz2',
  'xz',
  // Binaries & executables
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'iso',
  // Fonts
  'ttf',
  'otf',
  'woff',
  'woff2',
  'eot',
  // Certificates & keys
  'crt',
  'cer',
  'pem',
  'key',
  'pub'
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
export async function checkMissingLsp(
  filePath: string,
  languageId: string,
  openAddServerModal: (ext: string, langName: string) => void
): Promise<void> {
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

  // Non-code, plain text, and ini files never require an LSP server
  if (!languageId || languageId === 'plaintext' || languageId === 'ini') {
    return;
  }

  // Check if muted
  if (isLanguageMuted(ext) || isLanguageMuted(languageId)) {
    return;
  }

  // Check if a server config already exists (built-in or user-registered)
  const existingConfig = lspServerRegistry.findConfigForLanguage(languageId) ||
    lspServerRegistry.findConfigForLanguage(ext);

  if (existingConfig) {
    const isInstalled = await lspServerRegistry.isServerInstalled(existingConfig);
    if (isInstalled) {
      return; // Server is installed and ready
    }

    // Configured server is NOT installed on PATH
    const sessionKey = `uninstalled:${existingConfig.id}`.toLowerCase();
    if (sessionPromptedLangs.has(sessionKey)) {
      return;
    }
    sessionPromptedLangs.add(sessionKey);

    const actions: any[] = [];

    // Provide one-click Install Now action if install command is available
    if (existingConfig.installCommand) {
      actions.push({
        label: 'Install Now',
        primary: true,
        onClick: () => {
          lspInstaller.installServer(existingConfig);
        }
      });
    }

    actions.push({
      label: 'Configure',
      primary: !existingConfig.installCommand,
      onClick: () => {
        window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
      }
    });

    actions.push({
      label: "Don't Ask Again",
      primary: false,
      onClick: () => {
        muteLanguagePrompt(ext);
        if (languageId && languageId !== 'plaintext') {
          muteLanguagePrompt(languageId);
        }
        notificationService.info(
          'Preference Saved',
          `Muted LSP notifications for .${ext} files. You can configure language servers anytime in Settings -> Languages & LSP.`,
          undefined,
          4000
        );
      }
    });

    notificationService.warn(
      `${existingConfig.name} Not Installed`,
      `${existingConfig.name} is not installed on your system. Install it to enable IntelliSense, compiler diagnostics, and autocompletion.`,
      actions,
      12000
    );
    return;
  }

  // No server config exists at all
  const sessionKey = `missing:${ext}:${languageId}`.toLowerCase();
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
