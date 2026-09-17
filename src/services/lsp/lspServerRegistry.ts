/**
 * Language Server Registry & System PATH Discovery
 * Defines supported language servers and verifies machine availability.
 */

import { ServerConfig } from './lspTypes';

declare const window: any;

export const DEFAULT_SERVERS: ServerConfig[] = [
  {
    id: 'typescript',
    name: 'TypeScript & JavaScript',
    languages: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
    defaultCommand: 'typescript-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['typescript-language-server.cmd', 'typescript-language-server'],
    installGuide: 'npm install -g typescript typescript-language-server'
  },
  {
    id: 'python',
    name: 'Python (Pyright)',
    languages: ['python'],
    defaultCommand: 'pyright-langserver',
    defaultArgs: ['--stdio'],
    commandAliases: ['pyright-langserver.cmd', 'pyright-langserver', 'pylsp'],
    installGuide: 'pip install pyright (or npm install -g pyright)'
  },
  {
    id: 'rust',
    name: 'Rust Analyzer',
    languages: ['rust'],
    defaultCommand: 'rust-analyzer',
    defaultArgs: [],
    commandAliases: ['rust-analyzer.exe', 'rust-analyzer'],
    installGuide: 'rustup component add rust-analyzer'
  },
  {
    id: 'cpp',
    name: 'Clangd (C / C++)',
    languages: ['c', 'cpp'],
    defaultCommand: 'clangd',
    defaultArgs: ['--background-index'],
    commandAliases: ['clangd.exe', 'clangd'],
    installGuide: 'winget install LLVM.LLVM (or install LLVM Clang)'
  },
  {
    id: 'go',
    name: 'Go (gopls)',
    languages: ['go'],
    defaultCommand: 'gopls',
    defaultArgs: [],
    commandAliases: ['gopls.exe', 'gopls'],
    installGuide: 'go install golang.org/x/tools/gopls@latest'
  },
  {
    id: 'php',
    name: 'PHP (Intelephense)',
    languages: ['php'],
    defaultCommand: 'intelephense',
    defaultArgs: ['--stdio'],
    commandAliases: ['intelephense.cmd', 'intelephense'],
    installGuide: 'npm install -g intelephense'
  },
  {
    id: 'html',
    name: 'HTML Language Server',
    languages: ['html'],
    defaultCommand: 'vscode-html-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['vscode-html-language-server.cmd', 'vscode-html-language-server'],
    installGuide: 'npm install -g vscode-langservers-extracted'
  },
  {
    id: 'css',
    name: 'CSS Language Server',
    languages: ['css'],
    defaultCommand: 'vscode-css-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['vscode-css-language-server.cmd', 'vscode-css-language-server'],
    installGuide: 'npm install -g vscode-langservers-extracted'
  },
  {
    id: 'json',
    name: 'JSON Language Server',
    languages: ['json'],
    defaultCommand: 'vscode-json-language-server',
    defaultArgs: ['--stdio'],
    commandAliases: ['vscode-json-language-server.cmd', 'vscode-json-language-server'],
    installGuide: 'npm install -g vscode-langservers-extracted'
  }
];

class LspServerRegistry {
  private cache = new Map<string, boolean>();

  findConfigForLanguage(languageId: string): ServerConfig | undefined {
    const lang = languageId.toLowerCase();
    return DEFAULT_SERVERS.find((s) => s.languages.some((l) => l.toLowerCase() === lang));
  }

  async isServerInstalled(config: ServerConfig): Promise<boolean> {
    const cacheKey = config.id;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (typeof window === 'undefined' || !window.Neutralino?.os?.execCommand) {
      return false;
    }

    const commandsToTest = [config.defaultCommand, ...(config.commandAliases || [])];

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
