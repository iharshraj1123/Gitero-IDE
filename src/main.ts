import { initNeutralino } from './services/neutralino';
import { fsService } from './services/fs';
import { themeManager } from './themes/themeManager';
import { editorManager } from './editor/editor';
import { editorState, EditorTab } from './state/editorState';
import { vimIntegration } from './editor/vim';
import { TabBarComponent } from './ui/tabBar';
import { FileTreeComponent } from './ui/fileTree';
import { StatusBarComponent } from './ui/statusBar';
import { commandPalette, PaletteItem } from './ui/commandPalette';
import { SettingsModalComponent } from './ui/settingsModal';
import { preferencesService } from './services/preferences';

async function bootstrap() {
  console.log('[Gitero IDE] Bootstrapping...');
  const startTime = performance.now();

  // 1. Initialize native platform (if running in Neutralino binary)
  await initNeutralino();

  // 2. Initialize Themes and User CSS
  themeManager.init();

  // Initialize Typography from preferences
  const applyTypography = () => {
    const font = preferencesService.get('editor.fontFamily');
    const size = preferencesService.get('editor.fontSize');
    document.documentElement.style.setProperty('--editor-font-family', font);
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
  };
  applyTypography();
  preferencesService.subscribe('editor.fontFamily', applyTypography);
  preferencesService.subscribe('editor.fontSize', applyTypography);

  // 3. UI DOM References
  const sidebarEl = document.getElementById('sidebar') as HTMLElement;
  const fileTreeContainer = document.getElementById('file-tree-container') as HTMLElement;
  const tabBarContainer = document.getElementById('tab-bar') as HTMLElement;
  const statusBarContainer = document.getElementById('status-bar') as HTMLElement;
  const breadcrumbText = document.getElementById('breadcrumb-text') as HTMLElement;
  const emptyStateEl = document.getElementById('empty-state') as HTMLElement;
  const cmRoot = document.getElementById('codemirror-root') as HTMLElement;
  const workspaceTitle = document.getElementById('workspace-title') as HTMLElement;

  // 4. Initialize Settings Modal
  const settingsModal = new SettingsModalComponent({
    onVimToggled: (enabled) => {
      editorManager.toggleVim(enabled);
      statusBar.updateVimMode(vimIntegration.getCurrentMode());
      statusBar.showMessage(`Vim mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
  });

  // 5. Initialize Status Bar
  const statusBar = new StatusBarComponent(statusBarContainer, {
    onToggleVim: () => {
      const next = !vimIntegration.isEnabled();
      vimIntegration.setEnabled(next);
      editorManager.toggleVim(next);
      statusBar.updateVimMode(vimIntegration.getCurrentMode());
      statusBar.showMessage(`Vim mode ${next ? 'ENABLED' : 'DISABLED'}`);
    },
    onOpenThemePicker: () => {
      openThemePicker();
    }
  });

  // 6. Initialize Tab Bar
  new TabBarComponent(tabBarContainer);

  // 7. Initialize CodeMirror Editor
  editorManager.init(cmRoot, {
    initialContent: '',
    onContentChange: (newContent) => {
      const activeTab = editorState.getActiveTab();
      if (activeTab) {
        editorState.updateContent(activeTab.id, newContent);
      }
    },
    onCursorChange: (pos) => {
      statusBar.updateCursor(pos.line, pos.col);
      const activeTab = editorState.getActiveTab();
      if (activeTab) {
        editorState.updateCursor(activeTab.id, pos.line, pos.col);
      }
    }
  });

  // 8. Connect Vim Ex-Commands (:w, :q)
  vimIntegration.setCallbacks(
    async () => {
      await saveActiveFile();
    },
    () => {
      const activeTab = editorState.getActiveTab();
      if (activeTab) {
        editorState.closeTab(activeTab.id);
      }
    }
  );

  // 9. Initialize File Tree
  const fileTree = new FileTreeComponent(fileTreeContainer, (filePath, content) => {
    editorState.openFile(filePath, content);
  });

  // 10. Listen to Editor State changes (active tab, dirty indicators, etc.)
  let currentLoadedTabId: string | null = null;

  editorState.onChange((tabs, activeTab) => {
    statusBar.updateTabInfo(activeTab);

    if (!activeTab) {
      cmRoot.style.display = 'none';
      emptyStateEl.style.display = 'flex';
      breadcrumbText.textContent = 'Gitero IDE';
      currentLoadedTabId = null;
      return;
    }

    cmRoot.style.display = 'block';
    emptyStateEl.style.display = 'none';
    breadcrumbText.textContent = activeTab.path.replace(/\\/g, ' > ').replace(/\//g, ' > ');

    // Only reload document if active tab changed
    if (currentLoadedTabId !== activeTab.id) {
      currentLoadedTabId = activeTab.id;
      editorManager.loadDocument(activeTab.content, activeTab.path);
    }
  });

  // 11. Save Active File handler
  async function saveActiveFile() {
    const activeTab = editorState.getActiveTab();
    if (!activeTab) return;

    try {
      const currentContent = editorManager.getContent();
      await fsService.writeFile(activeTab.path, currentContent);
      editorState.markSaved(activeTab.id, currentContent);
      statusBar.showMessage(`Saved ${activeTab.name}`);
    } catch (err) {
      alert(`Failed to save file: ${err}`);
    }
  }

  // 12. Workspace Loader
  async function loadWorkspace(dirPath: string) {
    fsService.setWorkspace(dirPath);
    const folderName = dirPath.split(/[/\\]/).filter(Boolean).pop() || dirPath;
    workspaceTitle.textContent = folderName.toUpperCase();
    await fileTree.loadWorkspace(dirPath);
    statusBar.showMessage(`Opened folder: ${folderName}`);
  }

  // Load existing workspace or fallback
  const initialWorkspace = fsService.getWorkspace() || '.';
  loadWorkspace(initialWorkspace);

  // If no tabs are open, open a friendly README welcome
  if (editorState.getTabs().length === 0) {
    editorState.openFile(
      'README.md',
      `# Gitero IDE

A high-performance, VS Code-styled, Vim-customizable IDE.

### Key Shortcuts
* **Ctrl + P**: Quick Open File
* **Ctrl + Shift + P**: Command Palette
* **Ctrl + S** or **:w**: Save File
* **Ctrl + W** or **:q**: Close File
* **Ctrl + B**: Toggle Sidebar
* **Ctrl + ,**: Settings & Custom CSS

### Vim Mode
Vim mode is built-in and enabled by default!
* Press \`i\` for Insert Mode
* Press \`Esc\` for Normal Mode
* Press \`v\` for Visual Mode
* Type \`:w\` to save, \`:q\` to close tab
* Click the Vim pill in the bottom-left status bar to toggle anytime!

### Themes & Customization
Press **Ctrl + Shift + P** and select **Switch Color Theme** to choose from:
Tokyo Night, One Dark Pro, Dracula, Catppuccin Mocha, Monokai, and GitHub Dark.
`
    );
  }

  // 13. Buttons & Toolbar Events
  document.getElementById('btn-open-folder')?.addEventListener('click', async () => {
    const folder = await fsService.selectFolder();
    if (folder) {
      await loadWorkspace(folder);
    }
  });

  document.getElementById('btn-new-file')?.addEventListener('click', () => {
    const ws = fsService.getWorkspace() || '.';
    fileTree.promptCreateFile(ws);
  });

  document.getElementById('btn-new-folder')?.addEventListener('click', () => {
    const ws = fsService.getWorkspace() || '.';
    fileTree.promptCreateFolder(ws);
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    const ws = fsService.getWorkspace() || '.';
    fileTree.loadWorkspace(ws);
  });

  document.getElementById('btn-act-explorer')?.addEventListener('click', () => {
    sidebarEl.classList.toggle('collapsed');
  });

  document.getElementById('btn-act-theme')?.addEventListener('click', () => {
    openThemePicker();
  });

  document.getElementById('btn-act-settings')?.addEventListener('click', () => {
    settingsModal.open();
  });

  // 14. Command Palette Handlers
  function openQuickFilePicker() {
    const tabs = editorState.getTabs();
    const items: PaletteItem[] = tabs.map(t => ({
      id: t.id,
      title: t.name,
      detail: t.path,
      category: 'Open Tab',
      action: () => editorState.selectTab(t.id)
    }));

    commandPalette.open(items);
  }

  function openCommandPalette() {
    const commands: PaletteItem[] = [
      {
        id: 'theme.switch',
        title: 'Preferences: Switch Color Theme',
        category: 'Theme',
        action: () => openThemePicker()
      },
      {
        id: 'vim.toggle',
        title: `Vim: Toggle Vim Mode (${vimIntegration.isEnabled() ? 'Disable' : 'Enable'})`,
        category: 'Vim',
        action: () => {
          const next = !vimIntegration.isEnabled();
          vimIntegration.setEnabled(next);
          editorManager.toggleVim(next);
          statusBar.updateVimMode(vimIntegration.getCurrentMode());
          statusBar.showMessage(`Vim mode ${next ? 'ENABLED' : 'DISABLED'}`);
        }
      },
      {
        id: 'file.openFolder',
        title: 'File: Open Folder...',
        category: 'File',
        action: async () => {
          const folder = await fsService.selectFolder();
          if (folder) await loadWorkspace(folder);
        }
      },
      {
        id: 'file.save',
        title: 'File: Save',
        detail: 'Ctrl+S or :w',
        category: 'File',
        action: () => saveActiveFile()
      },
      {
        id: 'file.close',
        title: 'View: Close Active Editor',
        detail: 'Ctrl+W or :q',
        category: 'File',
        action: () => {
          const tab = editorState.getActiveTab();
          if (tab) editorState.closeTab(tab.id);
        }
      },
      {
        id: 'view.toggleSidebar',
        title: 'View: Toggle Sidebar Visibility',
        detail: 'Ctrl+B',
        category: 'View',
        action: () => sidebarEl.classList.toggle('collapsed')
      },
      {
        id: 'preferences.cursor.cycle',
        title: 'Preferences: Cycle Cursor Style (Line / Block / Underline)',
        detail: 'Num 0 / Insert or Alt+0',
        category: 'Preferences',
        action: () => {
          const style = editorManager.cycleCursorStyle();
          statusBar.showMessage(`Cursor Style: ${style.toUpperCase()} (Saved as preference)`);
        }
      },
      {
        id: 'preferences.cursor.line',
        title: 'Preferences: Set Cursor Style to Line (Bar) [Default]',
        category: 'Preferences',
        action: () => {
          editorManager.setCursorStyle('line');
          statusBar.showMessage('Cursor Style: LINE (Saved as preference)');
        }
      },
      {
        id: 'preferences.cursor.block',
        title: 'Preferences: Set Cursor Style to Block',
        category: 'Preferences',
        action: () => {
          editorManager.setCursorStyle('block');
          statusBar.showMessage('Cursor Style: BLOCK (Saved as preference)');
        }
      },
      {
        id: 'preferences.cursor.underline',
        title: 'Preferences: Set Cursor Style to Underline',
        category: 'Preferences',
        action: () => {
          editorManager.setCursorStyle('underline');
          statusBar.showMessage('Cursor Style: UNDERLINE (Saved as preference)');
        }
      },
      {
        id: 'settings.open',
        title: 'Preferences: Open Settings & Custom CSS',
        detail: 'Ctrl+,',
        category: 'Settings',
        action: () => settingsModal.open()
      }
    ];

    commandPalette.open(commands, '>');
  }

  function openThemePicker() {
    const themes = themeManager.getAllThemes();
    const current = themeManager.getCurrentTheme();

    const items: PaletteItem[] = themes.map(t => ({
      id: t.id,
      title: `${t.name} ${t.id === current.id ? '(Active)' : ''}`,
      detail: t.isDark ? 'Dark Theme' : 'Light Theme',
      category: 'Color Theme',
      action: () => {
        themeManager.applyTheme(t.id);
        statusBar.showMessage(`Theme changed to ${t.name}`);
      }
    }));

    commandPalette.open(items);
  }

  // 15. Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl + P (Quick Open)
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      openQuickFilePicker();
      return;
    }

    // Ctrl + Shift + P or F1 (Command Palette)
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === 'F1') {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    // Ctrl + S (Save)
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveActiveFile();
      return;
    }

    // Ctrl + B (Toggle Sidebar)
    if (e.ctrlKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      sidebarEl.classList.toggle('collapsed');
      return;
    }

    // Ctrl + , (Settings)
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      settingsModal.open();
      return;
    }

    // Ctrl + W (Close Active Tab)
    if (e.ctrlKey && e.key.toLowerCase() === 'w') {
      const activeTab = editorState.getActiveTab();
      if (activeTab) {
        e.preventDefault();
        editorState.closeTab(activeTab.id);
      }
      return;
    }

    // Num 0 (with NumLock off / emitting Insert) or Insert or Alt+0 -> Cycle cursor style and persist choice
    if (e.key === 'Insert' || (e.code === 'Numpad0' && e.key === 'Insert') || (e.altKey && (e.key === '0' || e.code === 'Numpad0'))) {
      e.preventDefault();
      const style = editorManager.cycleCursorStyle();
      statusBar.showMessage(`Cursor Style: ${style.toUpperCase()} (Saved as preference)`);
      return;
    }
  });

  const duration = (performance.now() - startTime).toFixed(1);
  console.log(`[Gitero IDE] Started in ${duration}ms`);
  statusBar.showMessage(`Gitero IDE ready in ${duration}ms`);
}

// Start app
window.addEventListener('DOMContentLoaded', bootstrap);
