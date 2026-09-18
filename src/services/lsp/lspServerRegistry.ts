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
    languages: ['json'],
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
  }

  deleteUserServer(id: string): void {
    const current = (preferencesService.get('lsp.userServers') as Record<string, any>) || {};
    delete current[id];
    preferencesService.set('lsp.userServers', current);
    this.cache.delete(id);
  }

  async isServerInstalled(config: ServerConfig): Promise<boolean> {
    const cacheKey = config.id;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (typeof window === 'undefined' || !window.Neutralino?.os?.execCommand) {
      return false;
    }

    const commandsToTest = [config.defaultCommand, ...(config.commandAliases || [])].filter(Boolean);

    for (const cmd of commandsToTest) {
      try {
        const cleanCmd = cmd.replace(/"/g, '');
        const res = await window.Neutralino.os.execCommand(`where.exe ${cleanCmd}`);
        if (res.exitCode === 0 && res.stdOut && res.stdOut.trim().length > 0) {
          this.cache.set(cacheKey, true);
          return true;
        }
      } catch {
        // Continue to next alias
      }
    }

    this.cache.set(cacheKey, false);
    return false;
  }

  clearCache() {
    this.cache.clear();
  }
}

export const lspServerRegistry = new LspServerRegistry();
