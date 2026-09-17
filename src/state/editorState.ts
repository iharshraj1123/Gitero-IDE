import { detectLanguage } from '../editor/languages';

export interface EditorTab {
  id: string; // file path
  name: string;
  path: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language: string;
  cursor: { line: number; col: number };
  viewMode?: 'raw' | 'rendered' | 'image' | 'binary' | 'git-graph';
}

export interface StateChangeListener {
  (tabs: EditorTab[], activeTab: EditorTab | null): void;
}

export class EditorStateManager {
  private currentWorkspace: string | null = null;
  private tabs: EditorTab[] = [];
  private activeTabId: string | null = null;
  private listeners: StateChangeListener[] = [];
  private closeListeners: ((tab: EditorTab) => void)[] = [];
  private closedTabsHistory: EditorTab[] = [];

  constructor() {
    this.loadPersistedTabs();
  }

  private getWorkspaceStorageKey(wsPath: string | null): string {
    if (!wsPath) return 'gitero_open_tabs';
    const normalized = wsPath.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
    let h = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
      h = Math.imul(h ^ normalized.charCodeAt(i), 0x01000193);
    }
    const hash = (h >>> 0).toString(16).padStart(8, '0');
    return `gitero_tabs_${hash}`;
  }

  private getWorkspaceActiveTabKey(wsPath: string | null): string {
    if (!wsPath) return 'gitero_active_tab';
    const normalized = wsPath.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
    let h = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
      h = Math.imul(h ^ normalized.charCodeAt(i), 0x01000193);
    }
    const hash = (h >>> 0).toString(16).padStart(8, '0');
    return `gitero_active_tab_${hash}`;
  }

  getCurrentWorkspace(): string | null {
    return this.currentWorkspace;
  }

  setWorkspace(dirPath: string | null) {
    const cleanCurrent = this.currentWorkspace ? this.currentWorkspace.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') : null;
    const cleanNew = dirPath ? dirPath.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') : null;

    if (cleanCurrent === cleanNew) {
      return;
    }

    // Persist current workspace tabs before switching
    if (this.currentWorkspace) {
      this.persist();
    }

    this.currentWorkspace = dirPath;
    this.closedTabsHistory = [];
    this.loadPersistedTabs();
    this.notify();
  }

  private loadPersistedTabs() {
    try {
      const tabsKey = this.getWorkspaceStorageKey(this.currentWorkspace);
      const activeKey = this.getWorkspaceActiveTabKey(this.currentWorkspace);
      let saved = localStorage.getItem(tabsKey);

      // Fallback if current workspace key is empty and no workspace is active yet
      if (!saved && !this.currentWorkspace) {
        saved = localStorage.getItem('gitero_open_tabs');
      }

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tabs = parsed.map((t: any) => ({
            ...t,
            originalContent: t.content,
            isDirty: false,
            viewMode: t.viewMode || 'raw'
          }));
          const savedActive = localStorage.getItem(activeKey) || (!this.currentWorkspace ? localStorage.getItem('gitero_active_tab') : null);
          this.activeTabId = (savedActive && this.tabs.some(t => t.id === savedActive)) ? savedActive : this.tabs[0].id;
          return;
        }
      }
      this.tabs = [];
      this.activeTabId = null;
    } catch (e) {
      console.warn('Failed to load persisted tabs', e);
      this.tabs = [];
      this.activeTabId = null;
    }
  }

  reloadPersistedTabs(): void {
    if (this.tabs.length === 0) {
      this.loadPersistedTabs();
      if (this.tabs.length > 0) {
        this.notify();
      }
    }
  }

  private persist() {
    try {
      const lightweight = this.tabs.map(t => ({
        id: t.id,
        name: t.name,
        path: t.path,
        content: t.content,
        language: t.language,
        cursor: t.cursor,
        viewMode: t.viewMode
      }));
      const tabsKey = this.getWorkspaceStorageKey(this.currentWorkspace);
      const activeKey = this.getWorkspaceActiveTabKey(this.currentWorkspace);

      localStorage.setItem(tabsKey, JSON.stringify(lightweight));
      if (this.activeTabId) {
        localStorage.setItem(activeKey, this.activeTabId);
      } else {
        localStorage.removeItem(activeKey);
      }

      // Also mirror to global keys for backward compatibility
      if (!this.currentWorkspace) {
        localStorage.setItem('gitero_open_tabs', JSON.stringify(lightweight));
        if (this.activeTabId) {
          localStorage.setItem('gitero_active_tab', this.activeTabId);
        }
      }
    } catch (e) {
      console.warn('Failed to persist tabs', e);
    }
  }

  getTabs(): EditorTab[] {
    return this.tabs;
  }

  getActiveTab(): EditorTab | null {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  openFile(filePath: string, content: string, options?: { viewMode?: 'raw' | 'rendered' }): EditorTab {
    const isMd = /\.md$/i.test(filePath) || /\.markdown$/i.test(filePath);
    const existing = this.tabs.find(t => t.id === filePath);
    if (existing) {
      if (options?.viewMode) {
        existing.viewMode = options.viewMode;
      }
      this.activeTabId = filePath;
      this.notify();
      return existing;
    }

    const name = filePath.split(/[/\\]/).pop() || filePath;
    const lang = detectLanguage(filePath).name;
    const viewMode = options?.viewMode || 'raw';

    const newTab: EditorTab = {
      id: filePath,
      name,
      path: filePath,
      content,
      originalContent: content,
      isDirty: false,
      language: lang,
      cursor: { line: 1, col: 1 },
      viewMode: isMd ? viewMode : 'raw'
    };

    this.tabs.push(newTab);
    this.activeTabId = filePath;
    this.persist();
    this.notify();
    return newTab;
  }

  openBinaryFile(filePath: string, mode: 'image' | 'binary'): EditorTab {
    const existing = this.tabs.find(t => t.id === filePath);
    if (existing) {
      existing.viewMode = mode;
      this.activeTabId = filePath;
      this.notify();
      return existing;
    }

    const name = filePath.split(/[/\\]/).pop() || filePath;
    const newTab: EditorTab = {
      id: filePath,
      name,
      path: filePath,
      content: '',
      originalContent: '',
      isDirty: false,
      language: mode === 'image' ? 'Image' : 'Binary',
      cursor: { line: 1, col: 1 },
      viewMode: mode
    };

    this.tabs.push(newTab);
    this.activeTabId = filePath;
    this.persist();
    this.notify();
    return newTab;
  }

  openCustomTab(id: string, name: string, viewMode: 'git-graph'): EditorTab {
    const existing = this.tabs.find((t) => t.id === id);
    if (existing) {
      existing.viewMode = viewMode;
      this.activeTabId = id;
      this.notify();
      return existing;
    }

    const newTab: EditorTab = {
      id,
      name,
      path: name,
      content: '',
      originalContent: '',
      isDirty: false,
      language: 'Git Graph',
      cursor: { line: 1, col: 1 },
      viewMode
    };

    this.tabs.push(newTab);
    this.activeTabId = id;
    this.persist();
    this.notify();
    return newTab;
  }

  private untitledCounter: number = 0;

  openUntitledFile(initialContent: string = ''): EditorTab {
    this.untitledCounter++;
    const name = `Untitled-${this.untitledCounter}`;
    const newTab: EditorTab = {
      id: name,
      name,
      path: name,
      content: initialContent,
      originalContent: '',
      isDirty: initialContent.length > 0,
      language: 'plaintext',
      cursor: { line: 1, col: 1 }
    };

    this.tabs.push(newTab);
    this.activeTabId = name;
    this.persist();
    this.notify();
    return newTab;
  }

  selectTab(id: string) {
    if (this.activeTabId !== id && this.tabs.some(t => t.id === id)) {
      this.activeTabId = id;
      this.persist();
      this.notify();
    }
  }

  closeTab(id: string): boolean {
    const index = this.tabs.findIndex(t => t.id === id);
    if (index === -1) return false;

    const tab = this.tabs[index];
    if (tab.isDirty) {
      const confirmClose = confirm(`File "${tab.name}" has unsaved changes. Close anyway?`);
      if (!confirmClose) return false;
    }

    const [closedTab] = this.tabs.splice(index, 1);
    if (closedTab && !closedTab.name.startsWith('Untitled-')) {
      this.closedTabsHistory.push({ ...closedTab, isDirty: false });
      if (this.closedTabsHistory.length > 20) {
        this.closedTabsHistory.shift();
      }
    }

    if (closedTab) {
      for (const l of this.closeListeners) {
        try { l(closedTab); } catch (err) { console.warn('Close listener error:', err); }
      }
    }

    if (this.activeTabId === id) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.min(index, this.tabs.length - 1);
        this.activeTabId = this.tabs[nextIndex].id;
      } else {
        this.activeTabId = null;
      }
    }

    this.persist();
    this.notify();
    return true;
  }

  closeAllTabs(): boolean {
    if (this.tabs.length === 0) return true;

    const dirtyTabs = this.tabs.filter(t => t.isDirty);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map(t => `"${t.name}"`).join(', ');
      const confirmClose = confirm(`${dirtyTabs.length} file(s) have unsaved changes: ${names}.\n\nClose all tabs anyway?`);
      if (!confirmClose) return false;
    }

    for (const tab of this.tabs) {
      if (!tab.name.startsWith('Untitled-')) {
        this.closedTabsHistory.push({ ...tab, isDirty: false });
      }
      for (const l of this.closeListeners) {
        try { l(tab); } catch (err) { console.warn('Close listener error:', err); }
      }
    }
    if (this.closedTabsHistory.length > 20) {
      this.closedTabsHistory = this.closedTabsHistory.slice(-20);
    }

    this.tabs = [];
    this.activeTabId = null;
    this.persist();
    this.notify();
    return true;
  }

  onClose(listener: (tab: EditorTab) => void): () => void {
    this.closeListeners.push(listener);
    return () => {
      const idx = this.closeListeners.indexOf(listener);
      if (idx !== -1) this.closeListeners.splice(idx, 1);
    };
  }

  canReopenClosedTab(): boolean {
    return this.closedTabsHistory.length > 0;
  }

  reopenClosedTab(): EditorTab | null {
    const tab = this.closedTabsHistory.pop();
    if (!tab) return null;
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.persist();
    this.notify();
    return tab;
  }

  updateContent(id: string, content: string) {
    const tab = this.tabs.find(t => t.id === id);
    if (tab) {
      tab.content = content;
      tab.isDirty = content !== tab.originalContent;
      this.persist();
      this.notify();
    }
  }

  updateCursor(id: string, line: number, col: number) {
    const tab = this.tabs.find(t => t.id === id);
    if (tab) {
      tab.cursor = { line, col };
    }
  }

  markSaved(id: string, savedContent: string) {
    const tab = this.tabs.find(t => t.id === id);
    if (tab) {
      tab.content = savedContent;
      tab.originalContent = savedContent;
      tab.isDirty = false;
      this.persist();
      this.notify();
    }
  }

  renameTab(oldId: string, newPath: string, savedContent: string) {
    const tab = this.tabs.find(t => t.id === oldId);
    if (tab) {
      const newName = newPath.split(/[/\\]/).pop() || newPath;
      tab.id = newPath;
      tab.path = newPath;
      tab.name = newName;
      tab.content = savedContent;
      tab.originalContent = savedContent;
      tab.isDirty = false;
      tab.language = detectLanguage(newPath).name;

      if (this.activeTabId === oldId) {
        this.activeTabId = newPath;
      }
      this.persist();
      this.notify();
    }
  }

  setTabLanguage(id: string, language: string) {
    const tab = this.tabs.find(t => t.id === id);
    if (tab) {
      tab.language = language;
      this.persist();
      this.notify();
    }
  }

  toggleActiveTabRenderMode(): 'raw' | 'rendered' | null {
    const active = this.getActiveTab();
    if (!active) return null;
    const isMd = /\.md$/i.test(active.path) || /\.markdown$/i.test(active.path);
    if (!isMd) return null;

    active.viewMode = active.viewMode === 'rendered' ? 'raw' : 'rendered';
    this.persist();
    this.notify();
    return active.viewMode;
  }

  onChange(listener: StateChangeListener) {
    this.listeners.push(listener);
  }

  private notify() {
    const active = this.getActiveTab();
    this.listeners.forEach(fn => fn(this.tabs, active));
  }
}

export const editorState = new EditorStateManager();
