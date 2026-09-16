import { FileNode, fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { getFileIconSvg, getFolderChevronSvg } from './icons';
import { gitService } from '../services/git';
import { diffModal } from './diffModal';
import { isImageFile, isBinaryFile } from '../editor/languages';
import { preferencesService } from '../services/preferences';

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  danger?: boolean;
}

export interface FileTreeOptions {
  onFileOpen?: (path: string, content: string, options?: { viewMode?: 'raw' | 'rendered' }) => void;
  onFindInFolder?: (folderPath: string) => void;
}

export class FileTreeComponent {
  private container: HTMLElement;
  private rootNodes: FileNode[] = [];
  private selectedNode: FileNode | null = null;
  private onFileOpen?: (path: string, content: string, options?: { viewMode?: 'raw' | 'rendered' }) => void;
  private onFindInFolder?: (folderPath: string) => void;
  private activeContextMenu: HTMLElement | null = null;
  private openDirectoryPaths: Set<string> = new Set();
  private activeInlineCreator: HTMLElement | null = null;

  constructor(
    container: HTMLElement, 
    onFileOpenOrOptions?: ((path: string, content: string, options?: { viewMode?: 'raw' | 'rendered' }) => void) | FileTreeOptions,
    onFindInFolder?: (folderPath: string) => void
  ) {
    this.container = container;
    if (typeof onFileOpenOrOptions === 'function') {
      this.onFileOpen = onFileOpenOrOptions;
      this.onFindInFolder = onFindInFolder;
    } else if (onFileOpenOrOptions) {
      this.onFileOpen = onFileOpenOrOptions.onFileOpen;
      this.onFindInFolder = onFileOpenOrOptions.onFindInFolder;
    }
    this.setupGlobalContextMenuDismiss();
    this.setupContainerContextMenu();
    this.setupKeyboardShortcuts();

    gitService.onStatusChange(() => {
      if (this.rootNodes.length > 0) {
        this.render();
      }
    });

    preferencesService.subscribe('workbench.iconTheme', () => {
      if (this.rootNodes.length > 0) {
        this.render();
      }
    });

    preferencesService.subscribe('workbench.customIconPackage', () => {
      if (this.rootNodes.length > 0) {
        this.render();
      }
    });
  }

  async loadWorkspace(dirPath: string) {
    this.container.innerHTML = `<div class="sidebar-loading">Scanning files...</div>`;
    try {
      this.loadExpandedDirectories(dirPath);
      this.rootNodes = await fsService.readDirectory(dirPath);
      await this.restoreExpandedChildren(this.rootNodes);
      this.render();
    } catch (err) {
      this.container.innerHTML = `<div class="sidebar-empty">Failed to load directory</div>`;
    }
  }

  private getExpandedFoldersStorageKey(dirPath: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < dirPath.length; i++) {
      h = Math.imul(h ^ dirPath.charCodeAt(i), 0x01000193);
    }
    const hash = (h >>> 0).toString(16).padStart(8, '0');
    return `gitero_expanded_${hash}`;
  }

  private loadExpandedDirectories(dirPath: string) {
    try {
      const storageKey = this.getExpandedFoldersStorageKey(dirPath);
      const legacyKey = `gitero_expanded_folders_${encodeURIComponent(dirPath)}`;
      const raw = localStorage.getItem(storageKey) || localStorage.getItem(legacyKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.openDirectoryPaths = new Set(arr);
        }
      }
    } catch (e) {
      console.warn('Failed to load expanded directory state', e);
    }
  }

  private saveExpandedDirectories() {
    const ws = fsService.getWorkspace();
    if (!ws) return;
    try {
      const storageKey = this.getExpandedFoldersStorageKey(ws);
      localStorage.setItem(storageKey, JSON.stringify(Array.from(this.openDirectoryPaths)));
    } catch (e) {
      console.warn('Failed to persist expanded directory state', e);
    }
  }

  private async restoreExpandedChildren(nodes: FileNode[]): Promise<void> {
    for (const node of nodes) {
      if (node.isDirectory && this.openDirectoryPaths.has(node.path)) {
        node.isOpen = true;
        try {
          node.children = await fsService.readDirectory(node.path);
          await this.restoreExpandedChildren(node.children);
        } catch (err) {
          console.warn('Failed to restore directory children:', node.path, err);
        }
      }
    }
  }

  render() {
    this.container.innerHTML = '';
    if (this.rootNodes.length === 0) {
      this.container.innerHTML = `<div class="sidebar-empty">Folder is empty</div>`;
      return;
    }

    const treeList = document.createElement('div');
    treeList.className = 'file-tree-list';

    for (const node of this.rootNodes) {
      treeList.appendChild(this.createNodeElement(node, 0));
    }

    this.container.appendChild(treeList);
  }

  private createNodeElement(node: FileNode, depth: number): HTMLElement {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'tree-item-container';
    itemContainer.setAttribute('data-path', node.path);
    itemContainer.setAttribute('data-depth', String(depth));

    const row = document.createElement('div');
    row.className = `tree-row ${this.selectedNode?.path === node.path ? 'selected' : ''}`;
    row.style.paddingLeft = `${depth * 14 + 10}px`;

    const chevron = document.createElement('span');
    chevron.className = 'tree-chevron';
    if (node.isDirectory) {
      chevron.innerHTML = getFolderChevronSvg(node.isOpen ?? false);
    } else {
      chevron.innerHTML = '<span class="chevron-spacer"></span>';
    }

    const iconSpan = document.createElement('span');
    iconSpan.className = 'tree-icon';
    iconSpan.innerHTML = getFileIconSvg(node.name, node.isDirectory, node.isOpen);

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;

    row.appendChild(chevron);
    row.appendChild(iconSpan);
    row.appendChild(label);

    // Git decorations
    if (node.isDirectory) {
      const changeCount = gitService.getFolderChangeCount(node.path);
      if (changeCount > 0) {
        row.classList.add('tree-row-has-changes');
        const folderDot = document.createElement('span');
        folderDot.className = 'tree-folder-git-dot';
        folderDot.title = `${changeCount} modified/untracked file(s) inside`;
        row.appendChild(folderDot);
      }
    } else {
      const gitStatus = gitService.getFileStatus(node.path);
      if (gitStatus) {
        row.classList.add(`tree-row-git-${gitStatus.status.toLowerCase()}`);
        const gitBadge = document.createElement('span');
        gitBadge.className = `tree-git-badge status-${gitStatus.status.toLowerCase()}`;
        gitBadge.textContent = gitStatus.status;
        gitBadge.title = gitStatus.isStaged 
          ? `Git: Staged (${gitStatus.status})` 
          : `Git: ${gitStatus.status === 'U' ? 'Untracked' : 'Modified'} (${gitStatus.status})`;
        row.appendChild(gitBadge);
      }
    }

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.style.display = node.isOpen ? 'block' : 'none';

    // Left click handling
    row.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.selectedNode = node;
      this.updateSelectionStyles();

      if (node.isDirectory) {
        node.isOpen = !node.isOpen;
        if (node.isOpen) {
          this.openDirectoryPaths.add(node.path);
        } else {
          this.openDirectoryPaths.delete(node.path);
        }
        this.saveExpandedDirectories();

        chevron.innerHTML = getFolderChevronSvg(node.isOpen);
        iconSpan.innerHTML = getFileIconSvg(node.name, node.isDirectory, node.isOpen);

        if (node.isOpen && (!node.children || node.children.length === 0)) {
          childrenContainer.innerHTML = `<div class="tree-loading" style="padding-left: ${(depth + 1) * 14 + 10}px">Loading...</div>`;
          childrenContainer.style.display = 'block';
          try {
            node.children = await fsService.readDirectory(node.path);
            await this.restoreExpandedChildren(node.children);
            childrenContainer.innerHTML = '';
            for (const child of node.children) {
              childrenContainer.appendChild(this.createNodeElement(child, depth + 1));
            }
          } catch (err) {
            childrenContainer.innerHTML = `<div class="tree-error">Error</div>`;
          }
        } else {
          childrenContainer.style.display = node.isOpen ? 'block' : 'none';
        }
      } else {
        // Guard: check if file is an image or binary
        if (isImageFile(node.path)) {
          editorState.openBinaryFile(node.path, 'image');
          return;
        }
        if (isBinaryFile(node.path)) {
          editorState.openBinaryFile(node.path, 'binary');
          return;
        }

        // Open code / text file from left sidebar -> Always open in RAW mode per specification
        try {
          const content = await fsService.readFile(node.path);
          if (this.onFileOpen) {
            this.onFileOpen(node.path, content, { viewMode: 'raw' });
          } else {
            editorState.openFile(node.path, content, { viewMode: 'raw' });
          }
        } catch (err) {
          alert(`Could not read file: ${node.name}`);
        }
      }
    });

    // Right click context menu handling
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectedNode = node;
      this.updateSelectionStyles();
      this.showContextMenu(e.clientX, e.clientY, node);
    });

    itemContainer.appendChild(row);
    if (node.isDirectory) {
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          childrenContainer.appendChild(this.createNodeElement(child, depth + 1));
        }
      }
      itemContainer.appendChild(childrenContainer);
    }

    return itemContainer;
  }

  private updateSelectionStyles() {
    const rows = this.container.querySelectorAll('.tree-row');
    rows.forEach(r => r.classList.remove('selected'));
    if (this.selectedNode) {
      const allRows = Array.from(this.container.querySelectorAll('.tree-row'));
      const activeRow = allRows.find(r => r.querySelector('.tree-label')?.textContent === this.selectedNode?.name);
      activeRow?.classList.add('selected');
    }
  }

  private setupContainerContextMenu() {
    this.container.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement).closest('.tree-row')) return;
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, null);
    });
  }

  private setupGlobalContextMenuDismiss() {
    window.addEventListener('click', () => {
      this.dismissContextMenu();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.dismissContextMenu();
      }
    });
  }

  private setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (!this.selectedNode) return;
      const isInputFocused = ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName || '');
      if (isInputFocused) return;

      if (e.key === 'F2') {
        e.preventDefault();
        this.promptRenameItem(this.selectedNode);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        this.promptDeleteItem(this.selectedNode);
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        fsService.revealInExplorer(this.selectedNode.path);
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        navigator.clipboard.writeText(this.selectedNode.path);
      }
    });
  }

  private dismissContextMenu() {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  private showContextMenu(x: number, y: number, node: FileNode | null) {
    this.dismissContextMenu();

    const ws = fsService.getWorkspace() || '.';
    const items: ContextMenuItem[] = [];

    if (node) {
      const targetDir = node.isDirectory ? node.path : this.getParentDir(node.path);

      items.push({
        label: 'New File...',
        action: () => this.promptCreateFile(targetDir)
      });
      items.push({
        label: 'New Folder...',
        action: () => this.promptCreateFolder(targetDir)
      });
      items.push({ label: '', divider: true });

      if (!node.isDirectory) {
        const gitStatus = gitService.getFileStatus(node.path);
        if (gitStatus) {
          items.push({
            label: 'Open Changes (Diff)',
            action: () => diffModal.open(gitStatus, gitStatus.isStaged)
          });
          if (gitStatus.isStaged) {
            items.push({
              label: 'Unstage Changes',
              action: () => gitService.unstageFile(gitStatus.relativePath)
            });
          } else {
            items.push({
              label: 'Stage Changes',
              action: () => gitService.stageFile(gitStatus.relativePath)
            });
          }
          items.push({
            label: 'Discard Changes',
            action: () => {
              if (confirm(`Discard changes to "${gitStatus.relativePath}"?`)) {
                gitService.discardFile(gitStatus.relativePath, gitStatus.status === 'U');
              }
            }
          });
          items.push({ label: '', divider: true });
        }
      }

      items.push({
        label: 'Reveal in File Explorer',
        shortcut: 'Shift+Alt+R',
        action: () => fsService.revealInExplorer(node.path)
      });
      items.push({
        label: 'Find in Folder...',
        shortcut: 'Shift+Alt+F',
        action: () => {
          if (this.onFindInFolder) {
            this.onFindInFolder(targetDir);
          }
        }
      });
      items.push({ label: '', divider: true });

      items.push({
        label: 'Copy Path',
        shortcut: 'Shift+Alt+C',
        action: () => navigator.clipboard.writeText(node.path)
      });
      items.push({
        label: 'Copy Relative Path',
        shortcut: 'Ctrl+K Ctrl+Shift+C',
        action: () => {
          const rel = this.getRelativePath(node.path, ws);
          navigator.clipboard.writeText(rel);
        }
      });
      items.push({ label: '', divider: true });

      items.push({
        label: 'Rename...',
        shortcut: 'F2',
        action: () => this.promptRenameItem(node)
      });
      items.push({
        label: 'Delete',
        shortcut: 'Delete',
        danger: true,
        action: () => this.promptDeleteItem(node)
      });
    } else {
      // Empty space context menu
      items.push({
        label: 'New File...',
        action: () => this.promptCreateFile(ws)
      });
      items.push({
        label: 'New Folder...',
        action: () => this.promptCreateFolder(ws)
      });
      items.push({ label: '', divider: true });
      items.push({
        label: 'Find in Folder...',
        shortcut: 'Shift+Alt+F',
        action: () => {
          if (this.onFindInFolder) {
            this.onFindInFolder(ws);
          }
        }
      });
      items.push({ label: '', divider: true });
      items.push({
        label: 'Refresh Explorer',
        action: () => this.loadWorkspace(ws)
      });
    }

    const menuEl = document.createElement('div');
    menuEl.className = 'explorer-context-menu';

    for (const item of items) {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'context-menu-divider';
        menuEl.appendChild(div);
        continue;
      }

      const row = document.createElement('div');
      row.className = `context-menu-item ${item.danger ? 'danger' : ''}`;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'context-menu-label';
      labelSpan.textContent = item.label;
      row.appendChild(labelSpan);

      if (item.shortcut) {
        const shortcutSpan = document.createElement('span');
        shortcutSpan.className = 'context-menu-shortcut';
        shortcutSpan.textContent = item.shortcut;
        row.appendChild(shortcutSpan);
      }

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissContextMenu();
        item.action?.();
      });

      menuEl.appendChild(row);
    }

    document.body.appendChild(menuEl);
    this.activeContextMenu = menuEl;

    const menuWidth = 240;
    const menuHeight = items.length * 28 + 14;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    const posX = x + menuWidth > winWidth ? winWidth - menuWidth - 8 : x;
    const posY = y + menuHeight > winHeight ? winHeight - menuHeight - 8 : y;

    menuEl.style.left = `${posX}px`;
    menuEl.style.top = `${posY}px`;
  }

  private getParentDir(itemPath: string): string {
    const sep = itemPath.includes('/') ? '/' : '\\';
    const parts = itemPath.split(sep);
    parts.pop();
    return parts.join(sep) || '.';
  }

  private getRelativePath(itemPath: string, rootDir: string): string {
    if (itemPath.startsWith(rootDir)) {
      return itemPath.slice(rootDir.length).replace(/^[/\\]/, '');
    }
    return itemPath;
  }

  async promptCreateFile(parentDir?: string) {
    this.startInlineCreation(parentDir, false);
  }

  async promptCreateFolder(parentDir?: string) {
    this.startInlineCreation(parentDir, true);
  }

  private startInlineCreation(targetParentDir?: string, isFolder: boolean = false) {
    // 1. Remove existing inline creator if one is already active
    if (this.activeInlineCreator) {
      this.activeInlineCreator.remove();
      this.activeInlineCreator = null;
    }

    const ws = fsService.getWorkspace() || '.';
    let resolvedDir = targetParentDir;

    // If targetParentDir was not provided or is root, check selected node
    if (!resolvedDir) {
      if (this.selectedNode) {
        resolvedDir = this.selectedNode.isDirectory
          ? this.selectedNode.path
          : this.getParentDir(this.selectedNode.path);
      } else {
        resolvedDir = ws;
      }
    }

    // Determine insertion container and depth
    let targetContainer: HTMLElement | null = null;
    let depth = 0;

    const normResolved = resolvedDir.replace(/\\/g, '/').replace(/\/$/, '');
    const normWs = ws.replace(/\\/g, '/').replace(/\/$/, '');

    if (normResolved === normWs) {
      targetContainer = this.container.querySelector('.file-tree-list');
      depth = 0;
    } else {
      // Find parent folder DOM node
      const allContainers = Array.from(this.container.querySelectorAll('.tree-item-container'));
      const parentContainer = allContainers.find(el => {
        const p = el.getAttribute('data-path')?.replace(/\\/g, '/').replace(/\/$/, '');
        return p === normResolved;
      }) as HTMLElement | null;

      if (parentContainer) {
        const parentDepth = parseInt(parentContainer.getAttribute('data-depth') || '0', 10);
        depth = parentDepth + 1;

        // Ensure parent folder is visually expanded
        const childrenContainer = parentContainer.querySelector('.tree-children') as HTMLElement;
        const chevron = parentContainer.querySelector('.tree-chevron') as HTMLElement;
        const folderIcon = parentContainer.querySelector('.tree-icon') as HTMLElement;

        if (childrenContainer) {
          childrenContainer.style.display = 'block';
          if (chevron) chevron.innerHTML = getFolderChevronSvg(true);
          const folderName = resolvedDir.split(/[/\\]/).pop() || resolvedDir;
          if (folderIcon) folderIcon.innerHTML = getFileIconSvg(folderName, true, true);
          this.openDirectoryPaths.add(resolvedDir);
          targetContainer = childrenContainer;
        }
      }
    }

    if (!targetContainer) {
      targetContainer = this.container.querySelector('.file-tree-list') || this.container;
      depth = 0;
    }

    // Build the inline creator element
    const creatorContainer = document.createElement('div');
    creatorContainer.className = 'tree-item-container tree-inline-creator';

    const row = document.createElement('div');
    row.className = 'tree-row tree-input-row';
    row.style.paddingLeft = `${depth * 14 + 10}px`;

    const chevron = document.createElement('span');
    chevron.className = 'tree-chevron';
    chevron.innerHTML = isFolder ? getFolderChevronSvg(false) : '<span class="chevron-spacer"></span>';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'tree-icon';
    iconSpan.innerHTML = isFolder ? getFileIconSvg('folder', true, false) : getFileIconSvg('', false, false);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-input';
    input.placeholder = isFolder ? 'Folder name...' : 'File name...';
    input.spellcheck = false;
    input.autocomplete = 'off';

    row.appendChild(chevron);
    row.appendChild(iconSpan);
    row.appendChild(input);
    creatorContainer.appendChild(row);

    // Insert at top of targetContainer
    if (targetContainer.firstChild) {
      targetContainer.insertBefore(creatorContainer, targetContainer.firstChild);
    } else {
      targetContainer.appendChild(creatorContainer);
    }

    this.activeInlineCreator = creatorContainer;

    // Dynamic badge/icon update on EVERY keystroke!
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (isFolder) {
        iconSpan.innerHTML = getFileIconSvg(val || 'folder', true, false);
      } else {
        iconSpan.innerHTML = getFileIconSvg(val, false, false);
      }
    });

    let isCommitting = false;

    const commit = async () => {
      if (isCommitting) return;
      isCommitting = true;

      const rawName = input.value.trim();
      creatorContainer.remove();
      this.activeInlineCreator = null;

      if (!rawName) return;

      const cleanName = rawName.replace(/[\/\\]/g, '');
      if (!cleanName) return;

      const sep = resolvedDir.includes('/') ? '/' : '\\';
      const targetPath = resolvedDir.endsWith(sep) ? `${resolvedDir}${cleanName}` : `${resolvedDir}${sep}${cleanName}`;

      try {
        if (isFolder) {
          await fsService.createFolder(targetPath);
          this.openDirectoryPaths.add(resolvedDir);
          this.openDirectoryPaths.add(targetPath);
          await this.loadWorkspace(fsService.getWorkspace() || '.');
        } else {
          await fsService.createFile(targetPath);
          this.openDirectoryPaths.add(resolvedDir);
          await this.loadWorkspace(fsService.getWorkspace() || '.');
          const content = await fsService.readFile(targetPath);
          if (this.onFileOpen) {
            this.onFileOpen(targetPath, content, { viewMode: 'raw' });
          } else {
            editorState.openFile(targetPath, content, { viewMode: 'raw' });
          }
        }
      } catch (err) {
        alert(`Failed to create ${isFolder ? 'folder' : 'file'}: ${err}`);
      }
    };

    const cancel = () => {
      if (isCommitting) return;
      isCommitting = true;
      creatorContainer.remove();
      this.activeInlineCreator = null;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!isCommitting) {
          cancel();
        }
      }, 120);
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 20);
  }

  async promptRenameItem(node: FileNode) {
    const newName = prompt('Enter new name:', node.name);
    if (!newName || newName === node.name) return;

    const parentDir = this.getParentDir(node.path);
    const sep = parentDir.includes('/') ? '/' : '\\';
    const newPath = parentDir.endsWith(sep) ? `${parentDir}${newName}` : `${parentDir}${sep}${newName}`;

    try {
      await fsService.renameItem(node.path, newPath);

      if (this.openDirectoryPaths.has(node.path)) {
        this.openDirectoryPaths.delete(node.path);
        this.openDirectoryPaths.add(newPath);
      }

      const tabs = editorState.getTabs();
      const matchingTab = tabs.find(t => t.path === node.path);
      if (matchingTab) {
        editorState.renameTab(matchingTab.id, newPath, matchingTab.content);
      }

      await this.loadWorkspace(fsService.getWorkspace() || '.');
    } catch (err) {
      alert(`Failed to rename item: ${err}`);
    }
  }

  async promptDeleteItem(node: FileNode) {
    const confirmDelete = confirm(`Are you sure you want to permanently delete "${node.name}"?`);
    if (!confirmDelete) return;

    try {
      await fsService.deleteItem(node.path, node.isDirectory);

      this.openDirectoryPaths.delete(node.path);

      const tabs = editorState.getTabs();
      const matchingTab = tabs.find(t => t.path === node.path);
      if (matchingTab) {
        editorState.closeTab(matchingTab.id);
      }

      await this.loadWorkspace(fsService.getWorkspace() || '.');
    } catch (err) {
      alert(`Failed to delete item: ${err}`);
    }
  }
}
