export type CursorStyle = 'line' | 'block' | 'underline';
export type CursorBlinking = 'blink' | 'smooth' | 'solid';

export interface GiteroPreferences {
  'editor.cursorStyle': CursorStyle;
  'editor.cursorBlinking': CursorBlinking;
  'editor.fontFamily': string;
  'editor.fontSize': number;
  'editor.theme': string;
  'editor.vimEnabled': boolean;
  'editor.customCss': string;
  'editor.tabSize': number;
  'editor.wordWrap': boolean;
  'files.autoSave': boolean;
  'files.autoSaveDelay': number;
  'keybindings': Record<string, string>;
}

const STORAGE_KEY = 'gitero_preferences_v1';

export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  'workbench.action.quickOpen': 'Ctrl+P',
  'workbench.action.showCommands': 'Ctrl+Shift+P',
  'workbench.action.files.save': 'Ctrl+S',
  'workbench.action.files.saveAs': 'Ctrl+Shift+S',
  'workbench.action.files.newUntitledFile': 'Ctrl+N',
  'workbench.action.files.openFile': 'Ctrl+O',
  'workbench.action.closeActiveEditor': 'Ctrl+W',
  'workbench.action.toggleSidebarVisibility': 'Ctrl+B',
  'workbench.action.terminal.toggleTerminal': 'Ctrl+`',
  'workbench.action.findInFiles': 'Ctrl+Shift+F',
  'workbench.view.scm': 'Ctrl+Shift+G',
  'workbench.action.gotoLine': 'Ctrl+G',
  'editor.action.toggleWordWrap': 'Alt+Z',
  'markdown.showPreview': 'Ctrl+Shift+V',
  'workbench.action.openSettings': 'Ctrl+,',
  'workbench.action.openShortcuts': 'Ctrl+K Ctrl+S'
};

export const DEFAULT_PREFERENCES: GiteroPreferences = {
  'editor.cursorStyle': 'line',
  'editor.cursorBlinking': 'blink',
  'editor.fontFamily': '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
  'editor.fontSize': 14,
  'editor.theme': 'tokyo-night',
  'editor.vimEnabled': true,
  'editor.customCss': '',
  'editor.tabSize': 2,
  'editor.wordWrap': false,
  'files.autoSave': false,
  'files.autoSaveDelay': 1000,
  'keybindings': { ...DEFAULT_KEYBINDINGS }
};

type PreferenceChangeListener<T> = (newValue: T, oldValue: T) => void;
type AnyPreferenceChangeListener = (preferences: GiteroPreferences) => void;

export class PreferencesService {
  private preferences: GiteroPreferences;
  private listeners: Map<string, Set<PreferenceChangeListener<any>>> = new Map();
  private anyListeners: Set<AnyPreferenceChangeListener> = new Set();

  constructor() {
    this.preferences = this.loadPreferences();
  }

  private loadPreferences(): GiteroPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed
        };
      }
    } catch (e) {
      console.warn('[PreferencesService] Failed to parse saved preferences:', e);
    }

    // Attempt zero-loss migration from legacy individual keys
    return this.migrateLegacyPreferences();
  }

  private migrateLegacyPreferences(): GiteroPreferences {
    const prefs: GiteroPreferences = { ...DEFAULT_PREFERENCES };

    try {
      const legacyTheme = localStorage.getItem('gitero_theme_id');
      if (legacyTheme) prefs['editor.theme'] = legacyTheme;

      const legacyFont = localStorage.getItem('gitero_font_family');
      if (legacyFont) prefs['editor.fontFamily'] = legacyFont;

      const legacySize = localStorage.getItem('gitero_font_size');
      if (legacySize) {
        const num = parseInt(legacySize, 10);
        if (!isNaN(num) && num >= 10 && num <= 32) {
          prefs['editor.fontSize'] = num;
        }
      }

      const legacyVim = localStorage.getItem('gitero_vim_enabled');
      if (legacyVim !== null) {
        prefs['editor.vimEnabled'] = legacyVim !== 'false';
      }

      const legacyCss = localStorage.getItem('gitero_custom_css');
      if (legacyCss) prefs['editor.customCss'] = legacyCss;

      // Save migrated settings
      this.savePreferences(prefs);
    } catch (e) {
      console.warn('[PreferencesService] Failed legacy migration:', e);
    }

    return prefs;
  }

  private savePreferences(prefs: GiteroPreferences): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error('[PreferencesService] Failed to save preferences to localStorage:', e);
    }
  }

  get<K extends keyof GiteroPreferences>(key: K): GiteroPreferences[K] {
    return this.preferences[key] ?? DEFAULT_PREFERENCES[key];
  }

  set<K extends keyof GiteroPreferences>(key: K, value: GiteroPreferences[K]): void {
    const oldValue = this.preferences[key];
    if (oldValue === value) return;

    this.preferences = {
      ...this.preferences,
      [key]: value
    };

    this.savePreferences(this.preferences);

    // Also synchronize legacy keys for external or legacy compatibility
    this.syncLegacyKey(key, value);

    // Notify listeners
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => {
        try {
          listener(value, oldValue);
        } catch (err) {
          console.error(`[PreferencesService] Error in listener for ${String(key)}:`, err);
        }
      });
    }

    this.anyListeners.forEach(listener => {
      try {
        listener(this.preferences);
      } catch (err) {
        console.error('[PreferencesService] Error in anyListener:', err);
      }
    });
  }

  update(partial: Partial<GiteroPreferences>): void {
    let hasChanges = false;
    const oldPrefs = { ...this.preferences };

    for (const [k, val] of Object.entries(partial)) {
      const key = k as keyof GiteroPreferences;
      if (this.preferences[key] !== val) {
        (this.preferences as any)[key] = val;
        hasChanges = true;
        this.syncLegacyKey(key, val as any);

        const keyListeners = this.listeners.get(key);
        if (keyListeners) {
          keyListeners.forEach(listener => {
            try {
              listener(val, oldPrefs[key]);
            } catch (err) {
              console.error(`[PreferencesService] Error in listener for ${String(key)}:`, err);
            }
          });
        }
      }
    }

    if (hasChanges) {
      this.savePreferences(this.preferences);
      this.anyListeners.forEach(listener => {
        try {
          listener(this.preferences);
        } catch (err) {
          console.error('[PreferencesService] Error in anyListener:', err);
        }
      });
    }
  }

  private syncLegacyKey<K extends keyof GiteroPreferences>(key: K, value: GiteroPreferences[K]): void {
    try {
      if (key === 'editor.theme') {
        localStorage.setItem('gitero_theme_id', String(value));
      } else if (key === 'editor.fontFamily') {
        localStorage.setItem('gitero_font_family', String(value));
      } else if (key === 'editor.fontSize') {
        localStorage.setItem('gitero_font_size', String(value));
      } else if (key === 'editor.vimEnabled') {
        localStorage.setItem('gitero_vim_enabled', value ? 'true' : 'false');
      } else if (key === 'editor.customCss') {
        localStorage.setItem('gitero_custom_css', String(value));
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  subscribe<K extends keyof GiteroPreferences>(
    key: K,
    listener: PreferenceChangeListener<GiteroPreferences[K]>
  ): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  subscribeAll(listener: AnyPreferenceChangeListener): () => void {
    this.anyListeners.add(listener);
    return () => {
      this.anyListeners.delete(listener);
    };
  }

  getAll(): GiteroPreferences {
    return { ...this.preferences };
  }

  getKeybinding(actionId: string): string {
    const map = this.preferences.keybindings || DEFAULT_KEYBINDINGS;
    return map[actionId] || DEFAULT_KEYBINDINGS[actionId] || '';
  }

  setKeybinding(actionId: string, shortcut: string): void {
    const currentMap = this.preferences.keybindings || { ...DEFAULT_KEYBINDINGS };
    const updated = { ...currentMap, [actionId]: shortcut };
    this.set('keybindings', updated);
  }

  resetKeybindings(): void {
    this.set('keybindings', { ...DEFAULT_KEYBINDINGS });
  }

  reset(key?: keyof GiteroPreferences): void {
    if (key) {
      this.set(key, DEFAULT_PREFERENCES[key]);
    } else {
      this.preferences = { ...DEFAULT_PREFERENCES };
      this.savePreferences(this.preferences);
      for (const [k, v] of Object.entries(DEFAULT_PREFERENCES)) {
        this.syncLegacyKey(k as keyof GiteroPreferences, v);
      }
      this.anyListeners.forEach(listener => listener(this.preferences));
    }
  }

  exportJson(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed === 'object' && parsed !== null) {
        this.update(parsed);
        return true;
      }
    } catch (e) {
      console.error('[PreferencesService] Failed to import preferences:', e);
    }
    return false;
  }
}

export const preferencesService = new PreferencesService();
