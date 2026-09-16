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
  viewMode?: 'raw' | 'rendered' | 'image' | 'binary';
}

export interface StateChangeListener {
  (tabs: EditorTab[], activeTab: EditorTab | null): void;
}

export class EditorStateManager {
  private tabs: EditorTab[] = [];
  private activeTabId: string | null = null;
  private listeners: StateChangeListener[] = [];

  constructor() {
    this.loadPersistedTabs();
  }

  private loadPersistedTabs() {
    try {
      const saved = localStorage.getItem('gitero_open_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.tabs = parsed.map((t: any) => ({
            ...t,
            originalContent: t.content,
            isDirty: false,
            viewMode: t.viewMode || 'raw'
          }));
          this.activeTabId = localStorage.getItem('gitero_active_tab') || this.tabs[0].id;
        }
      }
    } catch (e) {
      console.warn('Failed to load persisted tabs', e);
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
      localStorage.setItem('gitero_open_tabs', JSON.stringify(lightweight));
      if (this.activeTabId) {
        localStorage.setItem('gitero_active_tab', this.activeTabId);
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

    this.tabs.splice(index, 1);

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
