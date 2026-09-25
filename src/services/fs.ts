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
  private activeWatcherId: number | null = null;
  private watcherListeners: Set<() => void> = new Set();
  private watcherDebounceTimer: any = null;
  private workspaceFilesCache: { path: string; files: string[]; timestamp: number } | null = null;

  constructor() {
    this.currentWorkspace = localStorage.getItem('gitero_workspace_path') || null;
    this.setupWatcherListener();
    if (this.currentWorkspace) {
      this.watchWorkspace(this.currentWorkspace);
    }
  }

  private setupWatcherListener() {
    if (typeof window !== 'undefined' && window.Neutralino?.events) {
      window.Neutralino.events.on('watchFile', (evt?: any) => {
        const detail = evt?.detail || evt;
        if (detail && typeof detail === 'object') {
          // If a watcher ID is present, ensure it matches our active workspace watcher
          if (this.activeWatcherId !== null && detail.id !== undefined && detail.id !== this.activeWatcherId) {
            return;
          }

          const dir = (detail.dir || '').replace(/\\/g, '/').toLowerCase();
          const filename = (detail.filename || '').replace(/\\/g, '/').toLowerCase();
          const combined = `${dir}/${filename}`;

          // Ignore Git internals, package managers, build artifacts, temporary caches, and system storage
          if (
            combined.includes('/.git/') ||
            combined.endsWith('/.git') ||
            combined.includes('/.git') ||
            combined.includes('/node_modules/') ||
            combined.endsWith('/node_modules') ||
            combined.includes('/node_modules') ||
            combined.includes('/dist/') ||
            combined.endsWith('/dist') ||
            combined.includes('/target/') ||
            combined.endsWith('/target') ||
            combined.includes('/.storage/') ||
            combined.includes('/.vite/') ||
            combined.includes('/installer-output/') ||
            filename === 'neutralino.log' ||
            filename.endsWith('.tmp') ||
            filename.endsWith('.lock')
          ) {
            return;
          }
        }
        this.notifyWorkspaceChanged();
      });
    }
  }

  getWorkspace(): string | null {
    return this.currentWorkspace;
  }

  reloadWorkspaceFromStorage(): string | null {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('gitero_workspace_path') || null : null;
    this.currentWorkspace = saved;
    if (saved) {
      this.watchWorkspace(saved);
    }
    return saved;
  }

  setWorkspace(path: string | null) {
    this.currentWorkspace = path;
    this.invalidateFilesCache();
    if (path) {
      localStorage.setItem('gitero_workspace_path', path);
      this.watchWorkspace(path);
    } else {
      localStorage.removeItem('gitero_workspace_path');
      this.stopWorkspaceWatcher();
    }
  }

  onWorkspaceChanged(listener: () => void): () => void {
    this.watcherListeners.add(listener);
    return () => {
      this.watcherListeners.delete(listener);
    };
  }

  private notifyWorkspaceChanged() {
    clearTimeout(this.watcherDebounceTimer);
    this.watcherDebounceTimer = setTimeout(() => {
      this.invalidateFilesCache();
      this.watcherListeners.forEach(fn => {
        try {
          fn();
        } catch (err) {
          console.error('[fsService] Watcher listener error:', err);
        }
      });
    }, 300);
  }

  async watchWorkspace(dirPath: string): Promise<void> {
    if (!isNative()) return;
    await this.stopWorkspaceWatcher();

    try {
      const watcher = await window.Neutralino.filesystem.createWatcher(dirPath);
      if (watcher && typeof watcher.id === 'number') {
        this.activeWatcherId = watcher.id;
        console.log(`[fsService] Workspace watcher registered with ID ${this.activeWatcherId}`);
      }
    } catch (err) {
      console.warn('[fsService] Failed to create workspace watcher:', err);
    }
  }

  async stopWorkspaceWatcher(): Promise<void> {
    if (!isNative() || this.activeWatcherId === null) return;
    try {
      await window.Neutralino.filesystem.removeWatcher(this.activeWatcherId);
    } catch (err) {
      console.warn('[fsService] Failed to remove workspace watcher:', err);
    }
    this.activeWatcherId = null;
  }

  invalidateFilesCache() {
    this.workspaceFilesCache = null;
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

  private bomFiles = new Set<string>();

  async readFile(filePath: string): Promise<string> {
    if (isNative()) {
      try {
        const raw = await window.Neutralino.filesystem.readFile(filePath);
        if (raw && raw.charCodeAt(0) === 0xFEFF) {
          this.bomFiles.add(filePath.toLowerCase().replace(/\//g, '\\'));
          return raw.slice(1);
        }
        return raw;
      } catch (err) {
        console.error('Error reading file:', err);
        throw err;
      }
    } else {
      const raw = mockFiles[filePath] || `// Content of ${filePath}\n`;
      if (raw && raw.charCodeAt(0) === 0xFEFF) {
        return raw.slice(1);
      }
      return raw;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (isNative()) {
      try {
        const norm = filePath.toLowerCase().replace(/\//g, '\\');
        const finalContent = this.bomFiles.has(norm) && content.charCodeAt(0) !== 0xFEFF
          ? '\uFEFF' + content
          : content;
        await window.Neutralino.filesystem.writeFile(filePath, finalContent);
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

    const ignored = new Set([
      // Version control
      '.git', '.svn', '.hg',
      // Package managers
      'node_modules', 'vendor', 'bower_components', 'jspm_packages',
      // Build outputs
      'dist', 'build', 'out', 'output', 'target', 'bin', 'obj',
      // IDE / editor metadata
      '.vscode', '.idea', '__pycache__', '.cache', '.parcel-cache', '.next', '.nuxt',
      // PHP Composer / Laravel
      'storage', 'bootstrap/cache',
      // Logs
      'logs', 'log',
    ]);

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

  /** Maximum number of files the workspace index will track. Directories beyond this are too large to scan. */
  static readonly MAX_WORKSPACE_FILES = 5000;

  async getWorkspaceFiles(dirPath: string, forceRefresh: boolean = false): Promise<string[]> {
    if (!forceRefresh && this.workspaceFilesCache && this.workspaceFilesCache.path === dirPath) {
      if (Date.now() - this.workspaceFilesCache.timestamp < 30000) {
        return this.workspaceFilesCache.files;
      }
    }

    if (isNative()) {
      try {
        const cmd = `cd /d "${dirPath}" && git ls-files --cached --others --exclude-standard`;
        const res = await window.Neutralino.os.execCommand(cmd);
        if (res.exitCode === 0 && res.stdOut && res.stdOut.trim()) {
          const rawLines: string[] = res.stdOut.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
          const sep = dirPath.includes('/') ? '/' : '\\';
          const cleanDir = dirPath.replace(/[/\\]$/, '');
          // Cap at MAX_WORKSPACE_FILES to avoid freezing on massive monorepos
          const cappedLines = rawLines.slice(0, FileSystemService.MAX_WORKSPACE_FILES);
          const files: string[] = cappedLines.map((rel: string) => `${cleanDir}${sep}${rel.replace(/\//g, sep)}`);
          this.workspaceFilesCache = { path: dirPath, files, timestamp: Date.now() };
          return files;
        }
      } catch (e) {
        console.warn('[fsService] git ls-files fallback to scanAllFiles:', e);
      }
    }

    const files = await this.scanAllFiles(dirPath, Math.min(3000, FileSystemService.MAX_WORKSPACE_FILES));
    this.workspaceFilesCache = { path: dirPath, files, timestamp: Date.now() };
    return files;
  }

  async searchInFiles(
    dirPath: string,
    query: string,
    options: { isRegex?: boolean; caseSensitive?: boolean; wholeWord?: boolean } = {}
  ): Promise<Array<{ file: string; line: number; text: string }>> {
    const matches: Array<{ file: string; line: number; text: string }> = [];
    if (!query.trim()) return matches;

    const isMultiLine = query.includes('\n');

    if (isNative() && !isMultiLine) {
      // 1. High-performance native search via git grep (single-line queries only)
      try {
        const isGitCmd = `cd /d "${dirPath}" && git rev-parse --is-inside-work-tree`;
        const gitCheck = await window.Neutralino.os.execCommand(isGitCmd);
        if (gitCheck.exitCode === 0 && gitCheck.stdOut.trim() === 'true') {
          const flags: string[] = ['-n', '-I', '--untracked'];
          if (!options.caseSensitive) flags.push('-i');
          if (options.wholeWord) flags.push('-w');
          if (options.isRegex) flags.push('-E');
          else flags.push('-F');

          // Escape double quotes for cmd / powershell invocation
          const escapedQuery = query.replace(/"/g, '""');
          const gitGrepCmd = `cd /d "${dirPath}" && git grep ${flags.join(' ')} -- "${escapedQuery}"`;
          const res = await window.Neutralino.os.execCommand(gitGrepCmd);

          if (res.exitCode === 0 && res.stdOut) {
            const rawLines = res.stdOut.split(/\r?\n/);
            const sep = dirPath.includes('/') ? '/' : '\\';
            const cleanDir = dirPath.replace(/[/\\]$/, '');

            for (const line of rawLines) {
              if (!line) continue;
              const match = line.match(/^([^:]+):(\d+):(.*)$/);
              if (match) {
                const relPath = match[1].replace(/\//g, sep);
                const lineNum = parseInt(match[2], 10);
                const text = match[3];
                const fullPath = relPath.includes(':') ? relPath : `${cleanDir}${sep}${relPath}`;
                matches.push({
                  file: fullPath,
                  line: lineNum,
                  text: text.trim()
                });
                if (matches.length >= 1000) break;
              }
            }
            return matches;
          } else if (res.exitCode === 1) {
            // Exit code 1 means 0 matches
            return matches;
          }
        }
      } catch (err) {
        console.warn('[fsService] git grep failed, falling back to file scan:', err);
      }
    }

    // 2. Fallback / multi-line: file scan against full content
    const allFiles = await this.scanAllFiles(dirPath, 1000);
    let regex: RegExp;
    try {
      let pattern: string;
      if (options.isRegex) {
        // User-supplied regex — use as-is, but always add 's' flag equivalent via [\s\S] trick
        // We use the 's' (dotAll) flag so `.` matches newlines too
        pattern = query;
      } else {
        // Literal: escape, then replace literal \n in the (already newline-containing) pattern
        // with a regex that matches \r?\n (handles CRLF files too)
        pattern = query
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\n/g, '\\r?\\n');
      }
      if (options.wholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      const flags = ['g', 's', options.caseSensitive ? '' : 'i'].filter(Boolean).join('');
      regex = new RegExp(pattern, flags);
    } catch (e) {
      return matches;
    }

    for (const file of allFiles) {
      if (/\.(exe|png|jpg|jpeg|ico|gif|mp4|zip|tar|gz|pdf|woff|woff2|neu|dat)$/i.test(file)) continue;

      try {
        const content = await this.readFile(file);

        if (isMultiLine || options.isRegex) {
          // Search across full content, find starting line for each match
          regex.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = regex.exec(content)) !== null) {
            // Count line number of match start
            const before = content.slice(0, m.index);
            const lineNum = (before.match(/\n/g) || []).length + 1;
            // Show first line of the matched text as snippet
            const snippet = m[0].split('\n')[0].trim();
            matches.push({ file, line: lineNum, text: snippet });
            if (matches.length >= 500) return matches;
            // Avoid infinite loop on zero-length matches
            if (m[0].length === 0) regex.lastIndex++;
          }
        } else {
          // Single-line: fast line-by-line path
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
