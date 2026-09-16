import { FileNode, fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';

export interface ContextMenuItem {
  label: string;
  action?: () => void;
  divider?: boolean;
  danger?: boolean;
}

export class FileTreeComponent {
  private container: HTMLElement;
  private rootNodes: FileNode[] = [];
  private selectedPath: string | null = null;
  private onFileOpen?: (path: string, content: string) => void;
  private activeContextMenu: HTMLElement | null = null;

  constructor(container: HTMLElement, onFileOpen?: (path: string, content: string) => void) {
    this.container = container;
    this.onFileOpen = onFileOpen;
    this.setupGlobalContextMenuDismiss();
    this.setupContainerContextMenu();
  }

  async loadWorkspace(dirPath: string) {
    this.container.innerHTML = `<div class="sidebar-loading">Scanning files...</div>`;
    try {
      this.rootNodes = await fsService.readDirectory(dirPath);
      this.render();
    } catch (err) {
      this.container.innerHTML = `<div class="sidebar-empty">Failed to load directory</div>`;
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

    const row = document.createElement('div');
    row.className = `tree-row ${this.selectedPath === node.path ? 'selected' : ''}`;
    row.style.paddingLeft = `${depth * 14 + 10}px`;

    const chevron = document.createElement('span');
    chevron.className = 'tree-chevron';
    if (node.isDirectory) {
      chevron.innerHTML = node.isOpen ? '▾' : '▸';
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

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.style.display = node.isOpen ? 'block' : 'none';

    // Left click handling
    row.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.selectedPath = node.path;
      this.updateSelectionStyles();

      if (node.isDirectory) {
        node.isOpen = !node.isOpen;
        chevron.innerHTML = node.isOpen ? '▾' : '▸';
        iconSpan.innerHTML = getFileIconSvg(node.name, node.isDirectory, node.isOpen);

        if (node.isOpen && (!node.children || node.children.length === 0)) {
          childrenContainer.innerHTML = `<div class="tree-loading" style="padding-left: ${(depth + 1) * 14 + 10}px">Loading...</div>`;
          childrenContainer.style.display = 'block';
          try {
            node.children = await fsService.readDirectory(node.path);
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
        // Open file
        try {
          const content = await fsService.readFile(node.path);
          if (this.onFileOpen) {
            this.onFileOpen(node.path, content);
          } else {
            editorState.openFile(node.path, content);
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
      this.selectedPath = node.path;
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
      if (node.isDirectory) {
        items.push({
          label: 'New File...',
          action: () => this.promptCreateFile(node.path)
        });
        items.push({
          label: 'New Folder...',
          action: () => this.promptCreateFolder(node.path)
        });
        items.push({ label: '', divider: true });
      } else {
        items.push({
          label: 'Open File',
          action: async () => {
            try {
              const content = await fsService.readFile(node.path);
              if (this.onFileOpen) {
                this.onFileOpen(node.path, content);
              } else {
                editorState.openFile(node.path, content);
              }
            } catch (err) {
              alert(`Could not open file: ${err}`);
            }
          }
        });
        items.push({ label: '', divider: true });
      }

      items.push({
        label: 'Reveal in File Explorer',
        action: () => fsService.revealInExplorer(node.path)
      });
      items.push({
        label: 'Copy Path',
        action: () => navigator.clipboard.writeText(node.path)
      });
      items.push({
        label: 'Copy Relative Path',
        action: () => {
          const rel = this.getRelativePath(node.path, ws);
          navigator.clipboard.writeText(rel);
        }
      });
      items.push({ label: '', divider: true });
      items.push({
        label: 'Rename...',
        action: () => this.promptRenameItem(node)
      });
      items.push({
        label: 'Delete',
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
      row.textContent = item.label;

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismissContextMenu();
        item.action?.();
      });

      menuEl.appendChild(row);
    }

    document.body.appendChild(menuEl);
    this.activeContextMenu = menuEl;

    const menuWidth = 200;
    const menuHeight = items.length * 28 + 10;
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

  async promptCreateFile(parentDir: string) {
    const fileName = prompt('Enter new file name:');
    if (!fileName) return;

    const sep = parentDir.includes('/') ? '/' : '\\';
    const filePath = parentDir.endsWith(sep) ? `${parentDir}${fileName}` : `${parentDir}${sep}${fileName}`;

    try {
      await fsService.createFile(filePath);
      await this.loadWorkspace(fsService.getWorkspace() || '.');
      const content = await fsService.readFile(filePath);
      editorState.openFile(filePath, content);
    } catch (err) {
      alert(`Failed to create file: ${err}`);
    }
  }

  async promptCreateFolder(parentDir: string) {
    const folderName = prompt('Enter new folder name:');
    if (!folderName) return;

    const sep = parentDir.includes('/') ? '/' : '\\';
    const folderPath = parentDir.endsWith(sep) ? `${parentDir}${folderName}` : `${parentDir}${sep}${folderName}`;

    try {
      await fsService.createFolder(folderPath);
      await this.loadWorkspace(fsService.getWorkspace() || '.');
    } catch (err) {
      alert(`Failed to create folder: ${err}`);
    }
  }

  async promptRenameItem(node: FileNode) {
    const newName = prompt('Enter new name:', node.name);
    if (!newName || newName === node.name) return;

    const parentDir = this.getParentDir(node.path);
    const sep = parentDir.includes('/') ? '/' : '\\';
    const newPath = parentDir.endsWith(sep) ? `${parentDir}${newName}` : `${parentDir}${sep}${newName}`;

    try {
      await fsService.renameItem(node.path, newPath);

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
