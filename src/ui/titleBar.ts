import { isNative } from '../services/neutralino';
import { preferencesService } from '../services/preferences';

export interface MenuItem {
  label: string;
  shortcut?: string;
  checked?: () => boolean;
  disabled?: boolean;
  action?: () => void;
  divider?: boolean;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

export interface TitleBarOptions {
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onToggleAutoSave?: () => void;
  onOpenSettings?: () => void;
  onOpenThemePicker?: () => void;
  onOpenCommandPalette?: () => void;
  onQuickOpen?: () => void;
  onToggleSidebar?: () => void;
  onCycleCursor?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectAll?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onToggleWordWrap?: () => void;
  onGotoLine?: () => void;
  onToggleTerminal?: () => void;
  onOpenSearch?: () => void;
  onOpenGit?: () => void;
  onOpenShortcuts?: () => void;
  onCheckUpdates?: () => void;
  onAbout?: () => void;
}

export class TitleBarComponent {
  private container: HTMLElement;
  private options: TitleBarOptions;
  private titleElement!: HTMLElement;
  private menuBarElement!: HTMLElement;
  private activeMenuId: string | null = null;
  private isMaximizedState: boolean = false;
  private maxRestoreBtn!: HTMLElement;

  constructor(container: HTMLElement, options: TitleBarOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
    this.setupWindowControls();
    this.setupDraggable();
    this.setupGlobalClickDismiss();
  }

  private getMenuGroups(): MenuGroup[] {
    return [
      {
        id: 'file',
        label: 'File',
        items: [
          { label: 'New File', shortcut: 'Ctrl+N', action: this.options.onNewFile },
          { label: 'Open File...', shortcut: 'Ctrl+O', action: this.options.onOpenFile },
          { label: 'Open Folder...', shortcut: 'Ctrl+K Ctrl+O', action: this.options.onOpenFolder },
          { label: '', divider: true },
          { label: 'Save', shortcut: 'Ctrl+S', action: this.options.onSave },
          { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: this.options.onSaveAs },
          {
            label: 'Auto Save',
            checked: () => preferencesService.get('files.autoSave'),
            action: this.options.onToggleAutoSave
          },
          { label: '', divider: true },
          { label: 'Preferences', shortcut: 'Ctrl+,', action: this.options.onOpenSettings },
          { label: '', divider: true },
          {
            label: 'Exit',
            shortcut: 'Alt+F4',
            action: () => {
              if (isNative()) {
                window.Neutralino?.app?.exit();
              } else {
                window.close();
              }
            }
          }
        ]
      },
      {
        id: 'edit',
        label: 'Edit',
        items: [
          { label: 'Undo', shortcut: 'Ctrl+Z', action: this.options.onUndo },
          { label: 'Redo', shortcut: 'Ctrl+Y', action: this.options.onRedo },
          { label: '', divider: true },
          { label: 'Find', shortcut: 'Ctrl+F', action: this.options.onFind },
          { label: 'Replace', shortcut: 'Ctrl+H', action: this.options.onReplace }
        ]
      },
      {
        id: 'selection',
        label: 'Selection',
        items: [
          { label: 'Select All', shortcut: 'Ctrl+A', action: this.options.onSelectAll }
        ]
      },
      {
        id: 'view',
        label: 'View',
        items: [
          { label: 'Command Palette...', shortcut: 'Ctrl+Shift+P', action: this.options.onOpenCommandPalette },
          { label: 'Toggle Primary Sidebar', shortcut: 'Ctrl+B', action: this.options.onToggleSidebar },
          { label: 'Search in Files', shortcut: 'Ctrl+Shift+F', action: this.options.onOpenSearch },
          { label: 'Source Control', shortcut: 'Ctrl+Shift+G', action: this.options.onOpenGit },
          { label: 'Integrated Terminal', shortcut: 'Ctrl+`', action: this.options.onToggleTerminal },
          { label: '', divider: true },
          {
            label: 'Toggle Word Wrap',
            shortcut: 'Alt+Z',
            checked: () => preferencesService.get('editor.wordWrap'),
            action: this.options.onToggleWordWrap
          },
          { label: '', divider: true },
          { label: 'Switch Color Theme...', action: this.options.onOpenThemePicker },
          { label: 'Cycle Cursor Style', shortcut: 'Num 0', action: this.options.onCycleCursor }
        ]
      },
      {
        id: 'go',
        label: 'Go',
        items: [
          { label: 'Go to File...', shortcut: 'Ctrl+P', action: this.options.onQuickOpen },
          { label: 'Go to Line/Column...', shortcut: 'Ctrl+G', action: this.options.onGotoLine }
        ]
      },
      {
        id: 'run',
        label: 'Run',
        items: [
          {
            label: 'Run Without Debugging',
            shortcut: 'Ctrl+F5',
            action: () => {
              alert('Task runner initialized. Configure tasks.json to execute target binaries.');
            }
          }
        ]
      },
      {
        id: 'terminal',
        label: 'Terminal',
        items: [
          {
            label: 'Toggle Integrated Terminal',
            shortcut: 'Ctrl+`',
            action: this.options.onToggleTerminal
          }
        ]
      },
      {
        id: 'help',
        label: 'Help',
        items: [
          { label: 'Keyboard Shortcuts Reference', shortcut: 'Ctrl+K Ctrl+S', action: this.options.onOpenShortcuts },
          { label: 'Check for Updates...', action: this.options.onCheckUpdates },
          { label: '', divider: true },
          { label: 'About Gitero IDE', action: this.options.onAbout }
        ]
      }
    ];
  }

  private render() {
    this.container.innerHTML = `
      <div class="titlebar-left">
        <div class="titlebar-app-icon" title="Gitero IDE">
          <span class="app-logo-mark">G</span>
        </div>
        <nav class="titlebar-menubar" id="titlebar-menubar"></nav>
      </div>

      <div class="titlebar-center" id="titlebar-drag-region">
        <span class="titlebar-title" id="titlebar-title-text">Gitero IDE</span>
      </div>

      <div class="titlebar-right">
        <div class="titlebar-actions">
          <button class="titlebar-icon-btn" id="tb-btn-quick-open" title="Go to File (Ctrl+P)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
          <button class="titlebar-icon-btn" id="tb-btn-sidebar" title="Toggle Sidebar (Ctrl+B)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
          </button>
          <button class="titlebar-icon-btn" id="tb-btn-settings" title="Settings (Ctrl+,)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>

        <div class="window-controls">
          <button class="win-btn win-minimize" id="btn-win-min" title="Minimize">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1"/></svg>
          </button>
          <button class="win-btn win-maximize" id="btn-win-max" title="Maximize">
            <svg width="10" height="10" viewBox="0 0 10 10" class="icon-maximize"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>
            <svg width="10" height="10" viewBox="0 0 10 10" class="icon-restore" style="display: none;"><path d="M2.5 2.5V0.5h7v7H7.5M0.5 2.5h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1"/></svg>
          </button>
          <button class="win-btn win-close" id="btn-win-close" title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.1"/><line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" stroke-width="1.1"/></svg>
          </button>
        </div>
      </div>
    `;

    this.titleElement = this.container.querySelector('#titlebar-title-text') as HTMLElement;
    this.menuBarElement = this.container.querySelector('#titlebar-menubar') as HTMLElement;
    this.maxRestoreBtn = this.container.querySelector('#btn-win-max') as HTMLElement;

    this.renderMenuBar();

    // Wire quick buttons
    this.container.querySelector('#tb-btn-quick-open')?.addEventListener('click', () => {
      this.options.onQuickOpen?.();
    });
    this.container.querySelector('#tb-btn-sidebar')?.addEventListener('click', () => {
      this.options.onToggleSidebar?.();
    });
    this.container.querySelector('#tb-btn-settings')?.addEventListener('click', () => {
      this.options.onOpenSettings?.();
    });
  }

  private renderMenuBar() {
    this.menuBarElement.innerHTML = '';
    const groups = this.getMenuGroups();

    for (const group of groups) {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'menubar-item-wrapper';

      const button = document.createElement('button');
      button.className = `menubar-button ${this.activeMenuId === group.id ? 'active' : ''}`;
      button.textContent = group.label;

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.activeMenuId === group.id) {
          this.closeMenu();
        } else {
          this.openMenu(group.id);
        }
      });

      button.addEventListener('mouseenter', () => {
        if (this.activeMenuId !== null && this.activeMenuId !== group.id) {
          this.openMenu(group.id);
        }
      });

      itemWrapper.appendChild(button);

      // Render Dropdown Menu
      if (this.activeMenuId === group.id) {
        const dropdown = this.createDropdown(group);
        itemWrapper.appendChild(dropdown);
      }

      this.menuBarElement.appendChild(itemWrapper);
    }
  }

  private createDropdown(group: MenuGroup): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'titlebar-dropdown-menu';

    for (const item of group.items) {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        dropdown.appendChild(divider);
        continue;
      }

      const row = document.createElement('div');
      row.className = `dropdown-item ${item.disabled ? 'disabled' : ''}`;

      const checkSlot = document.createElement('span');
      checkSlot.className = 'dropdown-check-slot';
      if (item.checked && item.checked()) {
        checkSlot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      }

      const label = document.createElement('span');
      label.className = 'dropdown-item-label';
      label.textContent = item.label;

      const shortcut = document.createElement('span');
      shortcut.className = 'dropdown-item-shortcut';
      if (item.shortcut) {
        shortcut.textContent = item.shortcut;
      }

      row.appendChild(checkSlot);
      row.appendChild(label);
      row.appendChild(shortcut);

      if (!item.disabled) {
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeMenu();
          item.action?.();
        });
      }

      dropdown.appendChild(row);
    }

    return dropdown;
  }

  openMenu(id: string) {
    this.activeMenuId = id;
    this.renderMenuBar();
  }

  closeMenu() {
    if (this.activeMenuId !== null) {
      this.activeMenuId = null;
      this.renderMenuBar();
    }
  }

  private setupGlobalClickDismiss() {
    window.addEventListener('click', () => {
      this.closeMenu();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeMenuId !== null) {
        this.closeMenu();
      }
    });
  }

  private setupDraggable() {
    const dragRegion = this.container.querySelector('#titlebar-drag-region') as HTMLElement;
    if (!dragRegion) return;

    dragRegion.addEventListener('mousedown', (e) => {
      // Left mouse click on drag region starts dragging window
      if (e.button === 0 && isNative()) {
        window.Neutralino?.window?.beginDrag();
      }
    });

    dragRegion.addEventListener('dblclick', async () => {
      await this.toggleMaximize();
    });
  }

  private setupWindowControls() {
    const minBtn = this.container.querySelector('#btn-win-min') as HTMLElement;
    const closeBtn = this.container.querySelector('#btn-win-close') as HTMLElement;

    minBtn.addEventListener('click', async () => {
      if (isNative()) {
        await window.Neutralino?.window?.minimize();
      }
    });

    this.maxRestoreBtn.addEventListener('click', async () => {
      await this.toggleMaximize();
    });

    closeBtn.addEventListener('click', async () => {
      if (isNative()) {
        await window.Neutralino?.app?.exit();
      } else {
        window.close();
      }
    });

    // Check initial maximized state
    this.checkMaximizedState();
  }

  private async checkMaximizedState() {
    if (isNative()) {
      try {
        await window.Neutralino?.window?.maximize();
        const isMax = await window.Neutralino?.window?.isMaximized();
        this.updateMaximizedVisual(isMax ?? true);
      } catch (e) {
        // Ignore in web preview
      }
    }
  }

  private updateMaximizedVisual(isMaximized: boolean) {
    this.isMaximizedState = isMaximized;
    const maxIcon = this.maxRestoreBtn.querySelector('.icon-maximize') as HTMLElement;
    const restoreIcon = this.maxRestoreBtn.querySelector('.icon-restore') as HTMLElement;

    if (maxIcon && restoreIcon) {
      if (isMaximized) {
        maxIcon.style.display = 'none';
        restoreIcon.style.display = 'block';
        this.maxRestoreBtn.title = 'Restore Down';
      } else {
        maxIcon.style.display = 'block';
        restoreIcon.style.display = 'none';
        this.maxRestoreBtn.title = 'Maximize';
      }
    }
  }

  private async toggleMaximize() {
    if (isNative()) {
      try {
        const isMax = await window.Neutralino?.window?.isMaximized();
        if (isMax) {
          await window.Neutralino?.window?.unmaximize();
          this.updateMaximizedVisual(false);
        } else {
          await window.Neutralino?.window?.maximize();
          this.updateMaximizedVisual(true);
        }
      } catch (e) {
        console.warn('Failed to toggle maximize', e);
      }
    } else {
      this.isMaximizedState = !this.isMaximizedState;
      this.updateMaximizedVisual(this.isMaximizedState);
    }
  }

  updateTitle(title: string) {
    if (this.titleElement) {
      this.titleElement.textContent = title;
    }
    if (isNative()) {
      window.Neutralino?.window?.setTitle(title);
    }
  }
}
