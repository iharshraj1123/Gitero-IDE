import { FileNode, fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';

export class FileTreeComponent {
  private container: HTMLElement;
  private rootNodes: FileNode[] = [];
  private selectedPath: string | null = null;
  private onFileOpen?: (path: string, content: string) => void;

  constructor(container: HTMLElement, onFileOpen?: (path: string, content: string) => void) {
    this.container = container;
    this.onFileOpen = onFileOpen;
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
}
