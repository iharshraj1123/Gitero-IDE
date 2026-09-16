import { isNative } from './neutralino';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isOpen?: boolean;
}

// Memory fallback store for web preview
const mockFiles: Record<string, string> = {
  'README.md': '# Welcome to Gitero IDE\n\nA high-performance, VS Code-styled, Vim-empowered IDE built with instant startup time in mind.\n\n### Features\n- Instant startup time (<100ms)\n- Complete VS Code themes (One Dark, Tokyo Night, Dracula, Monokai, Catppuccin)\n- Full Vim modal editing (`:w`, `:q`, normal/insert/visual modes)\n- Multi-language support (JS, TS, Rust, Python, C++, HTML, CSS, JSON, Go, etc.)\n- User custom CSS injection\n',
  'src/main.rs': 'fn main() {\n    println!("Hello from Gitero IDE!");\n}\n',
  'src/index.ts': 'export const greeting: string = "Hello World!";\nconsole.log(greeting);\n',
  'style.css': '/* Gitero Custom Styles */\nbody {\n  font-family: system-ui, sans-serif;\n}\n'
};

export class FileSystemService {
  private currentWorkspace: string | null = null;

  constructor() {
    this.currentWorkspace = localStorage.getItem('gitero_workspace_path') || null;
  }

  getWorkspace(): string | null {
    return this.currentWorkspace;
  }

  setWorkspace(path: string | null) {
    this.currentWorkspace = path;
    if (path) {
      localStorage.setItem('gitero_workspace_path', path);
    } else {
      localStorage.removeItem('gitero_workspace_path');
    }
  }

  async selectFolder(): Promise<string | null> {
    if (isNative()) {
      try {
        const folder = await window.Neutralino.os.showFolderDialog('Select Project Folder', {
          defaultPath: this.currentWorkspace || undefined
        });
        if (folder) {
          this.setWorkspace(folder);
          return folder;
        }
      } catch (err) {
        console.error('Failed to show folder dialog:', err);
      }
    } else {
      // In web fallback, prompt user or use mock workspace
      const folder = prompt('Enter a workspace name or path:', this.currentWorkspace || 'Gitero Workspace');
      if (folder) {
        this.setWorkspace(folder);
        return folder;
      }
    }
    return null;
  }

  async openFileDialog(): Promise<string | null> {
    if (isNative()) {
      try {
        const files = await window.Neutralino.os.showOpenDialog('Open File', {
          multiSelections: false,
          defaultPath: this.currentWorkspace || undefined,
          filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Code & Text Files', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'c', 'cpp', 'h', 'hpp', 'html', 'css', 'json', 'md', 'txt', 'go', 'java', 'xml', 'yaml', 'yml', 'sh', 'bat', 'ps1'] }
          ]
        });
        if (files && files.length > 0) {
          return files[0];
        }
      } catch (err) {
        console.error('Failed to show open dialog:', err);
      }
    } else {
      return prompt('Open file (mock path or name):', 'README.md');
    }
    return null;
  }

  async saveFileDialog(defaultPath?: string): Promise<string | null> {
    if (isNative()) {
      try {
        const selected = await window.Neutralino.os.showSaveDialog('Save As', {
          defaultPath: defaultPath || this.currentWorkspace || undefined,
          forceOverwrite: true,
          filters: [
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        return selected || null;
      } catch (err) {
        console.error('Failed to show save dialog:', err);
        return null;
      }
    } else {
      return prompt('Save file as:', defaultPath || 'untitled.txt');
    }
  }

  async readDirectory(dirPath: string): Promise<FileNode[]> {
    if (isNative()) {
      try {
        const entries = await window.Neutralino.filesystem.readDirectory(dirPath);
        const nodes: FileNode[] = [];

        for (const entry of entries) {
          if (entry.entry === '.' || entry.entry === '..' || entry.entry === '.git' || entry.entry === 'node_modules' || entry.entry === 'target' || entry.entry === 'dist') {
            continue;
          }

          const isDir = entry.type === 'DIRECTORY';
          const sep = dirPath.includes('/') ? '/' : '\\';
          const fullPath = dirPath.endsWith(sep) ? `${dirPath}${entry.entry}` : `${dirPath}${sep}${entry.entry}`;

          nodes.push({
            name: entry.entry,
            path: fullPath,
            isDirectory: isDir,
            children: isDir ? [] : undefined,
            isOpen: false
          });
        }

        // Sort: directories first, then alphabetically
        return nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
      } catch (err) {
        console.error('Error reading directory:', err);
        return [];
      }
    } else {
      // Web fallback
      return this.getMockDirectoryNodes();
    }
  }

  async readFile(filePath: string): Promise<string> {
    if (isNative()) {
      try {
        return await window.Neutralino.filesystem.readFile(filePath);
      } catch (err) {
        console.error('Error reading file:', err);
        throw err;
      }
    } else {
      return mockFiles[filePath] || `// Content of ${filePath}\n`;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (isNative()) {
      try {
        await window.Neutralino.filesystem.writeFile(filePath, content);
      } catch (err) {
        console.error('Error writing file:', err);
        throw err;
      }
    } else {
      mockFiles[filePath] = content;
    }
  }

  async createFile(filePath: string): Promise<void> {
    if (isNative()) {
      try {
        await window.Neutralino.filesystem.writeFile(filePath, '');
      } catch (err) {
        console.error('Error creating file:', err);
        throw err;
      }
    } else {
      mockFiles[filePath] = '';
    }
  }

  async createFolder(folderPath: string): Promise<void> {
    if (isNative()) {
      try {
        await window.Neutralino.filesystem.createDirectory(folderPath);
      } catch (err) {
        console.error('Error creating directory:', err);
        throw err;
      }
    }
  }

  async deleteItem(itemPath: string, isDirectory: boolean): Promise<void> {
    if (isNative()) {
      try {
        await window.Neutralino.filesystem.remove(itemPath);
      } catch (err) {
        console.error('Error deleting item:', err);
        throw err;
      }
    } else {
      delete mockFiles[itemPath];
    }
  }

  async renameItem(oldPath: string, newPath: string): Promise<void> {
    if (isNative()) {
      try {
        await window.Neutralino.filesystem.move(oldPath, newPath);
      } catch (err) {
        console.error('Error renaming item:', err);
        throw err;
      }
    } else {
      if (mockFiles[oldPath] !== undefined) {
        mockFiles[newPath] = mockFiles[oldPath];
        delete mockFiles[oldPath];
      }
    }
  }

  async revealInExplorer(filePath: string): Promise<void> {
    if (isNative()) {
      try {
        await window.Neutralino.os.execCommand(`explorer.exe /select,"${filePath}"`);
      } catch (err) {
        console.error('Failed to reveal in explorer:', err);
      }
    }
  }

  async scanAllFiles(dirPath: string, maxFiles: number = 2000): Promise<string[]> {
    const result: string[] = [];
    if (!isNative()) {
      return Object.keys(mockFiles);
    }

    const ignored = new Set(['.git', 'node_modules', 'dist', 'target', '.vscode', '.idea', 'build', 'out']);

    const traverse = async (currentDir: string) => {
      if (result.length >= maxFiles) return;
      try {
        const entries = await window.Neutralino.filesystem.readDirectory(currentDir);
        for (const entry of entries) {
          if (entry.entry === '.' || entry.entry === '..' || ignored.has(entry.entry)) continue;
          const sep = currentDir.includes('/') ? '/' : '\\';
          const fullPath = currentDir.endsWith(sep) ? `${currentDir}${entry.entry}` : `${currentDir}${sep}${entry.entry}`;
          if (entry.type === 'DIRECTORY') {
            await traverse(fullPath);
          } else {
            result.push(fullPath);
            if (result.length >= maxFiles) return;
          }
        }
      } catch (e) {
        // Ignore unreadable
      }
    };

    await traverse(dirPath);
    return result;
  }

  async searchInFiles(
    dirPath: string,
    query: string,
    options: { isRegex?: boolean; caseSensitive?: boolean; wholeWord?: boolean } = {}
  ): Promise<Array<{ file: string; line: number; text: string }>> {
    const matches: Array<{ file: string; line: number; text: string }> = [];
    if (!query.trim()) return matches;

    const allFiles = await this.scanAllFiles(dirPath, 1000);
    let regex: RegExp;
    try {
      let pattern = options.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (options.wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
    } catch (e) {
      return matches;
    }

    for (const file of allFiles) {
      if (/\.(exe|png|jpg|jpeg|ico|gif|mp4|zip|tar|gz|pdf|woff|woff2|neu|dat)$/i.test(file)) continue;

      try {
        const content = await this.readFile(file);
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            matches.push({
              file,
              line: i + 1,
              text: lines[i].trim()
            });
            if (matches.length >= 500) return matches;
          }
        }
      } catch (e) {
        // Ignore unreadable
      }
    }
    return matches;
  }

  private getMockDirectoryNodes(): FileNode[] {
    return [
      {
        name: 'src',
        path: 'src',
        isDirectory: true,
        isOpen: true,
        children: [
          { name: 'index.ts', path: 'src/index.ts', isDirectory: false },
          { name: 'main.rs', path: 'src/main.rs', isDirectory: false }
        ]
      },
      { name: 'README.md', path: 'README.md', isDirectory: false },
      { name: 'style.css', path: 'style.css', isDirectory: false }
    ];
  }
}

export const fsService = new FileSystemService();
