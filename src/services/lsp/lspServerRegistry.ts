/**
 * Language Server Registry & System PATH Discovery
 * Defines supported language servers and verifies machine availability.
 */

import type { ServerConfig } from './lspTypes';
export type { ServerConfig };

declare const window: any;

export const DEFAULT_SERVERS: ServerConfig[] = [
  {
    id: 'typescript',
    name: 'TypeScript & JavaScript',
    languages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
    defaultCommand: 'typescript-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['typescript-language-server.cmd', 'typescript-language-server'],
    installGuide: 'npm install -g typescript@^5 typescript-language-server',
    installCommand: 'npm install -g typescript@^5 typescript-language-server',
    packageManager: 'npm'
  },
  {
    id: 'python',
    name: 'Python (Pyright)',
    languages: ['python'],
    defaultCommand: 'pyright-langserver',
    defaultArgs: ['--stdio'],
    commandAliases: ['pyright-langserver.cmd', 'pyright-langserver', 'pylsp'],
    installGuide: 'npm install -g pyright (or pip install pyright)',
    installCommand: 'npm install -g pyright',
    packageManager: 'npm'
  },
  {
    id: 'rust',
    name: 'Rust Analyzer',
    languages: ['rust'],
    defaultCommand: 'rust-analyzer',
    defaultArgs: [],
    commandAliases: ['rust-analyzer.exe', 'rust-analyzer'],
    installGuide: 'rustup component add rust-analyzer',
    installCommand: 'rustup component add rust-analyzer',
    packageManager: 'rustup'
  },
  {
    id: 'cpp',
    name: 'Clangd (C / C++)',
    languages: ['c', 'cpp'],
    defaultCommand: 'clangd',
    defaultArgs: ['--background-index'],
    commandAliases: ['clangd.exe', 'clangd'],
    installGuide: 'winget install LLVM.LLVM (or install LLVM Clang)',
    installCommand: 'winget install LLVM.LLVM --silent',
    packageManager: 'winget'
  },
  {
    id: 'go',
    name: 'Go (gopls)',
    languages: ['go'],
    defaultCommand: 'gopls',
    defaultArgs: [],
    commandAliases: ['gopls.exe', 'gopls'],
    installGuide: 'go install golang.org/x/tools/gopls@latest',
    installCommand: 'go install golang.org/x/tools/gopls@latest',
    packageManager: 'go'
  },
  {
    id: 'php',
    name: 'PHP (Intelephense)',
    languages: ['php'],
    defaultCommand: 'intelephense',
    defaultArgs: ['--stdio'],
    commandAliases: ['intelephense.cmd', 'intelephense'],
    installGuide: 'npm install -g intelephense',
    installCommand: 'npm install -g intelephense',
    packageManager: 'npm'
  },
  {
    id: 'html',
    name: 'HTML Language Server',
    languages: ['html'],
    defaultCommand: 'vscode-html-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['vscode-html-language-server.cmd', 'vscode-html-language-server'],
    installGuide: 'npm install -g vscode-langservers-extracted',
    installCommand: 'npm install -g vscode-langservers-extracted',
    packageManager: 'npm'
  },
  {
    id: 'css',
    name: 'CSS Language Server',
    languages: ['css'],
    defaultCommand: 'vscode-css-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['vscode-css-language-server.cmd', 'vscode-css-language-server'],
    installGuide: 'npm install -g vscode-langservers-extracted',
    installCommand: 'npm install -g vscode-langservers-extracted',
    packageManager: 'npm'
  },
  {
    id: 'json',
    name: 'JSON Language Server',
    languages: ['json', 'jsonc'],
    defaultCommand: 'vscode-json-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['vscode-json-language-server.cmd', 'vscode-json-language-server'],
    installGuide: 'npm install -g vscode-langservers-extracted',
    installCommand: 'npm install -g vscode-langservers-extracted',
    packageManager: 'npm'
  }
];

import { preferencesService } from '../preferences';

class LspServerRegistry {
  private cache = new Map<string, boolean>();
  private resolvedPathCache = new Map<string, string | null>();

  getUserServers(): ServerConfig[] {
    try {
      const userObj = preferencesService.get('lsp.userServers') as Record<string, any> || {};
      return Object.values(userObj).map((u) => ({
        id: u.id,
        name: u.name,
        languages: u.languages || [],
        defaultCommand: u.defaultCommand || u.command || '',
        defaultArgs: u.defaultArgs || u.args || [],
        installGuide: u.installGuide || '',
        installCommand: u.installCommand || undefined,
        packageManager: u.packageManager || undefined,
        commandAliases: u.commandAliases || []
      }));
    } catch {
      return [];
    }
  }

  getAllServers(): ServerConfig[] {
    return [...DEFAULT_SERVERS, ...this.getUserServers()];
  }

  findConfigForLanguage(languageId: string): ServerConfig | undefined {
    const lang = languageId.toLowerCase();
    return this.getAllServers().find((s: ServerConfig) => s.languages.some((l: string) => l.toLowerCase() === lang));
  }

  registerUserServer(config: ServerConfig): void {
    const current = (preferencesService.get('lsp.userServers') as Record<string, any>) || {};
    preferencesService.set('lsp.userServers', {
      ...current,
      [config.id]: config
    });
    this.cache.delete(config.id);
    this.resolvedPathCache.delete(config.id);
  }

  deleteUserServer(id: string): void {
    const current = (preferencesService.get('lsp.userServers') as Record<string, any>) || {};
    delete current[id];
    preferencesService.set('lsp.userServers', current);
    this.cache.delete(id);
    this.resolvedPathCache.delete(id);
  }

  async resolveServerExecutable(config: ServerConfig): Promise<string | null> {
    const cacheKey = config.id;
    if (this.resolvedPathCache.has(cacheKey)) {
      return this.resolvedPathCache.get(cacheKey)!;
    }

    if (typeof window === 'undefined' || !window.Neutralino?.os?.execCommand) {
      return null;
    }

    // Check user preference overrides
    try {
      const customServers = (preferencesService.get('lsp.customServers') as Record<string, any>) || {};
      const userPref = customServers[config.id];
      if (userPref?.command) {
        this.resolvedPathCache.set(cacheKey, userPref.command);
        this.cache.set(cacheKey, true);
        return userPref.command;
      }
    } catch {}

    // Retrieve environment variables
    let userProfile = '';
    let localAppData = '';
    try {
      if (window.Neutralino?.os?.getEnv) {
        userProfile = (await window.Neutralino.os.getEnv('USERPROFILE')) || '';
        localAppData = (await window.Neutralino.os.getEnv('LOCALAPPDATA')) || '';
      }
    } catch {}

    const candidates: string[] = [config.defaultCommand, ...(config.commandAliases || [])];

    // Language-specific well-known paths
    if (config.id === 'go') {
      if (userProfile) {
        candidates.push(`${userProfile}\\go\\bin\\gopls.exe`);
      }
    } else if (config.id === 'rust') {
      if (userProfile) {
        candidates.push(`${userProfile}\\.cargo\\bin\\rust-analyzer.exe`);
        // Also check active/installed rustup toolchains directly
        try {
          const toolchainsDir = `${userProfile}\\.rustup\\toolchains`;
          if (window.Neutralino?.filesystem?.readDirectory) {
            const entries = await window.Neutralino.filesystem.readDirectory(toolchainsDir);
            for (const entry of entries || []) {
              if (entry.type === 'DIRECTORY') {
                candidates.push(`${toolchainsDir}\\${entry.entry}\\bin\\rust-analyzer.exe`);
              }
            }
          }
        } catch {}
      }
    } else if (config.id === 'cpp') {
      candidates.push(
        'C:\\Program Files\\LLVM\\bin\\clangd.exe',
        'C:\\Program Files (x86)\\LLVM\\bin\\clangd.exe',
        'C:\\msys64\\mingw64\\bin\\clangd.exe',
        'C:\\msys64\\ucrt64\\bin\\clangd.exe',
        'C:\\msys64\\clang64\\bin\\clangd.exe'
      );
    }

    for (const rawCmd of candidates) {
      if (!rawCmd) continue;
      const cmd = rawCmd.replace(/%USERPROFILE%/gi, userProfile).replace(/%LOCALAPPDATA%/gi, localAppData).trim();
      const isPath = cmd.includes('\\') || cmd.includes('/') || cmd.includes(':');

      if (isPath) {
        // Direct file path check
        try {
          if (window.Neutralino?.filesystem?.getStats) {
            const stats = await window.Neutralino.filesystem.getStats(cmd);
            if (stats) {
              if (config.id === 'rust') {
                const isRustValid = await this.verifyRustExecutable(cmd);
                if (!isRustValid) continue;
              }
              this.resolvedPathCache.set(cacheKey, cmd);
              this.cache.set(cacheKey, true);
              return cmd;
            }
          }
        } catch {
          // Path does not exist or access error
        }
      } else {
        // System PATH lookup via where.exe
        try {
          const cleanCmd = cmd.replace(/"/g, '');
          const res = await window.Neutralino.os.execCommand(`where.exe ${cleanCmd}`);
          if (res.exitCode === 0 && res.stdOut && res.stdOut.trim().length > 0) {
            const lines = res.stdOut.trim().split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
            const nonWindowsApps = lines.filter((l: string) => !l.toLowerCase().includes('\\appdata\\local\\microsoft\\windowsapps\\'));
            const pool = nonWindowsApps.length > 0 ? nonWindowsApps : lines;

            // Windows priority: npm installs extensionless POSIX bash scripts into %APPDATA%\npm\ which cannot
            // be spawned by Windows CreateProcess without a shell. Always prefer Windows executables (.cmd, .bat, .exe).
            let targetPath = pool.find((l: string) => /\.(cmd|exe|bat)$/i.test(l)) || pool[0];

            if (targetPath && !/\.[a-zA-Z0-9]+$/.test(targetPath)) {
              for (const ext of ['.cmd', '.exe', '.bat']) {
                const candidateWithExt = `${targetPath}${ext}`;
                if (pool.includes(candidateWithExt)) {
                  targetPath = candidateWithExt;
                  break;
                }
              }
            }

            if (targetPath.toLowerCase().includes('\\appdata\\local\\microsoft\\windowsapps\\')) {
              // Microsoft Store 0-byte execution alias; probe before accepting
              const probe = await window.Neutralino.os.execCommand(`cmd.exe /c "${cleanCmd} --version"`);
              if (probe.exitCode !== 0) continue;
            }

            if (config.id === 'rust') {
              const isRustValid = await this.verifyRustExecutable(targetPath || cleanCmd);
              if (!isRustValid) continue;
            }

            this.resolvedPathCache.set(cacheKey, targetPath || cleanCmd);
            this.cache.set(cacheKey, true);
            return targetPath || cleanCmd;
          }
        } catch {
          // Not found on PATH
        }
      }
    }

    this.resolvedPathCache.set(cacheKey, null);
    this.cache.set(cacheKey, false);
    return null;
  }

  private async verifyRustExecutable(cmdOrPath: string): Promise<boolean> {
    try {
      let userProfile = '';
      try {
        if (window.Neutralino?.os?.getEnv) {
          userProfile = (await window.Neutralino.os.getEnv('USERPROFILE')) || '';
        }
      } catch {}

      const envPrefix = userProfile ? `set PATH=${userProfile}\\.cargo\\bin;%PATH% && ` : '';
      const escaped = cmdOrPath.includes(' ') ? `"${cmdOrPath}"` : cmdOrPath;
      const res = await window.Neutralino.os.execCommand(`cmd.exe /c "${envPrefix}${escaped} --version"`);
      if (res.exitCode !== 0) {
        return false;
      }
      const combined = `${res.stdOut || ''} ${res.stdErr || ''}`.toLowerCase();
      if (combined.includes('unknown binary') || combined.includes('not installed')) {
        return false;
      }
      if (combined.includes('rust-analyzer')) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async isServerInstalled(config: ServerConfig): Promise<boolean> {
    const cacheKey = config.id;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    const resolved = await this.resolveServerExecutable(config);
    return resolved !== null;
  }

  clearCache() {
    this.cache.clear();
    this.resolvedPathCache.clear();
  }
}

export const lspServerRegistry = new LspServerRegistry();
