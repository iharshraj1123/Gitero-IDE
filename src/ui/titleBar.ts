import { isNative } from '../services/neutralino';
import { preferencesService } from '../services/preferences';

export interface MenuItem {
  label: string;
  shortcut?: string;
  checked?: () => boolean;
  disabled?: boolean;
  action?: () => void;
  divider?: boolean;
  submenu?: MenuItem[] | (() => MenuItem[]);
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
  onOpenRecent?: () => void;
  onOpenWorkspace?: (dirPath: string) => void;
  onClearRecentWorkspaces?: () => void;
  onReopenClosedEditor?: () => void;
  canReopenClosedEditor?: () => boolean;
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
  onToggleIndentGuides?: () => void;
  onToggleMinimap?: () => void;
  onToggleOverviewRuler?: () => void;
  onGotoLine?: () => void;
  onToggleTerminal?: () => void;
  onOpenSearch?: () => void;
  onOpenGit?: () => void;
  onOpenShortcuts?: () => void;
  onToggleFullScreen?: () => void;
  onToggleDevTools?: () => void;
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
  private savedBounds: { x: number; y: number; width: number; height: number } | null = null;
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
          {
            label: 'Open Recent',
            submenu: () => this.getOpenRecentSubmenu(),
            action: this.options.onOpenRecent
          },
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
          {
            label: 'Toggle Indentation Guides',
            checked: () => preferencesService.get('editor.renderIndentGuides') !== false,
            action: this.options.onToggleIndentGuides
          },
          {
            label: 'Toggle Minimap',
            checked: () => preferencesService.get('editor.minimap.enabled') !== false,
            action: this.options.onToggleMinimap
          },
          {
            label: 'Toggle Scrollbar Overview Ruler',
            checked: () => preferencesService.get('editor.overviewRuler.enabled') !== false,
            action: this.options.onToggleOverviewRuler
          },
          {
            label: 'Toggle Full Screen',
            shortcut: 'F11',
            action: this.options.onToggleFullScreen
          },
          { label: '', divider: true },
          { label: 'Switch Color Theme...', action: this.options.onOpenThemePicker },
          { label: 'Cycle Cursor Style', shortcut: 'Alt+0', action: this.options.onCycleCursor }
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
          { label: 'Toggle Developer Tools', shortcut: 'F12', action: this.options.onToggleDevTools },
          { label: 'Check for Updates...', action: this.options.onCheckUpdates },
          { label: '', divider: true },
          { label: 'About Gitero IDE', action: this.options.onAbout }
        ]
      }
    ];
  }

  private getOpenRecentSubmenu(): MenuItem[] {
    const items: MenuItem[] = [];

    items.push({
      label: 'Reopen Closed Editor',
      shortcut: 'Ctrl+Shift+T',
      action: () => {
        this.options.onReopenClosedEditor?.();
      },
      disabled: !this.options.canReopenClosedEditor?.()
    });

    items.push({ label: '', divider: true });

    const recent: string[] = preferencesService.get('workbench.recentWorkspaces') || [];
    if (recent.length > 0) {
      for (const dir of recent) {
        items.push({
          label: dir,
          action: () => {
            this.options.onOpenWorkspace?.(dir);
          }
        });
      }
    } else {
      items.push({
        label: 'No Recent Workspaces',
        disabled: true
      });
    }

    items.push({ label: '', divider: true });

    items.push({
      label: 'More...',
      shortcut: 'Ctrl+R',
      action: this.options.onOpenRecent
    });

    items.push({
      label: 'Clear Recently Opened...',
      action: () => {
        this.options.onClearRecentWorkspaces?.();
      }
    });

    return items;
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
    return this.createMenuContainer(group.items);
  }

  private createMenuContainer(items: MenuItem[], isSubmenu = false): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = isSubmenu ? 'titlebar-dropdown-menu titlebar-submenu' : 'titlebar-dropdown-menu';

    for (const item of items) {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'dropdown-divider';
        dropdown.appendChild(divider);
        continue;
      }

      const hasSubmenu = !!item.submenu;
      const row = document.createElement('div');
      row.className = `dropdown-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''}`;
      if (item.label && item.label.length > 25) {
        row.title = item.label;
      }

      const checkSlot = document.createElement('span');
      checkSlot.className = 'dropdown-check-slot';
      if (item.checked && item.checked()) {
        checkSlot.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      }

      const label = document.createElement('span');
      label.className = 'dropdown-item-label';
      label.textContent = item.label;

      row.appendChild(checkSlot);
      row.appendChild(label);

      if (hasSubmenu) {
        const arrow = document.createElement('span');
        arrow.className = 'dropdown-item-arrow';
        arrow.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        row.appendChild(arrow);

        let submenuEl: HTMLElement | null = null;
        let openTimer: any = null;
        let closeTimer: any = null;

        const openSub = () => {
          clearTimeout(closeTimer);
          if (submenuEl) return;
          const subItems = typeof item.submenu === 'function' ? item.submenu() : (item.submenu || []);
          submenuEl = this.createMenuContainer(subItems, true);
          row.appendChild(submenuEl);
          row.classList.add('submenu-active');
        };

        const closeSub = () => {
          clearTimeout(openTimer);
          if (submenuEl) {
            submenuEl.remove();
            submenuEl = null;
            row.classList.remove('submenu-active');
          }
        };

        row.addEventListener('mouseenter', () => {
          clearTimeout(closeTimer);
          openTimer = setTimeout(openSub, 60);
        });

        row.addEventListener('mouseleave', () => {
          clearTimeout(openTimer);
          closeTimer = setTimeout(closeSub, 150);
        });

        row.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.titlebar-submenu')) return;
          e.stopPropagation();
          this.closeMenu();
          item.action?.();
        });
      } else {
        const shortcut = document.createElement('span');
        shortcut.className = 'dropdown-item-shortcut';
        if (item.shortcut) {
          shortcut.textContent = item.shortcut;
        }
        row.appendChild(shortcut);

        if (!item.disabled) {
          row.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeMenu();
            item.action?.();
          });
        }
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
    let isMouseDown = false;
    let startX = 0;
    let startY = 0;

    // Mouse down on title bar (outside buttons and menu items) prepares drag
    this.container.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (e.button !== 0) return;
      if (target.closest('button, .menu-item, .menu-trigger, .win-btn, .titlebar-icon-btn, .titlebar-menubar')) {
        return;
      }
      isMouseDown = true;
      startX = e.screenX;
      startY = e.screenY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const dist = Math.hypot(e.screenX - startX, e.screenY - startY);
      if (dist > 5) {
        isMouseDown = false;
        if (isNative()) {
          window.Neutralino?.window?.beginDrag();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    // Double-click on any empty title bar space maximizes / restores
    this.container.addEventListener('dblclick', async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, .menu-item, .menu-trigger, .win-btn, .titlebar-icon-btn')) {
        return;
      }
      e.preventDefault();
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

    // Start with non-maximized visual until the native API confirms state
    this.updateMaximizedVisual(false);

    // Check initial maximized state from native API (fires after JS maximize() resolves)
    this.checkMaximizedState();

    // Listen to resize events to react when user snaps or resizes the window
    window.addEventListener('resize', () => {
      this.checkMaximizedState();
    });

    // Listen to native Neutralino window state events if available
    if ((window as any).Neutralino?.events) {
      (window as any).Neutralino.events.on('windowMaximize', () => {
        this.updateMaximizedVisual(true);
      });
      (window as any).Neutralino.events.on('windowRestore', () => {
        this.updateMaximizedVisual(false);
      });
      (window as any).Neutralino.events.on('windowUnmaximize', () => {
        this.updateMaximizedVisual(false);
      });
    }
  }

  private async checkMaximizedState() {
    if (isNative() && window.Neutralino?.window?.isMaximized) {
      try {
        const isMax = await window.Neutralino.window.isMaximized();
        this.updateMaximizedVisual(Boolean(isMax));
      } catch (e) {
        this.updateMaximizedVisual(false);
      }
    } else {
      const isMax = window.innerWidth >= (window.screen?.availWidth || 0) - 6 && window.innerHeight >= (window.screen?.availHeight || 0) - 8;
      this.updateMaximizedVisual(isMax);
    }
  }

  private updateMaximizedVisual(isMaximized: boolean) {
    this.isMaximizedState = isMaximized;

    if (isMaximized) {
      document.body.classList.add('window-maximized');
    } else {
      document.body.classList.remove('window-maximized');
    }

    if (this.maxRestoreBtn) {
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
  }

  private async toggleMaximize() {
    if (isNative() && window.Neutralino?.window) {
      try {
        const isMax = await window.Neutralino.window.isMaximized();
        if (isMax) {
          await window.Neutralino.window.unmaximize();
          this.updateMaximizedVisual(false);
        } else {
          await window.Neutralino.window.maximize();
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
