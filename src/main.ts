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
import { TitleBarComponent } from './ui/titleBar';
import { preferencesService } from './services/preferences';
import { SearchPanelComponent } from './ui/searchPanel';
import { GitPanelComponent } from './ui/gitPanel';
import { TerminalPanelComponent } from './ui/terminalPanel';
import { ShortcutsModalComponent } from './ui/shortcutsModal';
import { SUPPORTED_LANGUAGES } from './editor/languages';
import { MarkdownViewerComponent } from './ui/markdownViewer';

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
  const titleBarContainer = document.getElementById('app-titlebar') as HTMLElement;
  const sidebarEl = document.getElementById('sidebar') as HTMLElement;
  const explorerPane = document.getElementById('explorer-pane') as HTMLElement;
  const searchPane = document.getElementById('search-pane') as HTMLElement;
  const gitPane = document.getElementById('git-pane') as HTMLElement;
  const bottomPanelEl = document.getElementById('bottom-panel') as HTMLElement;
  const fileTreeContainer = document.getElementById('file-tree-container') as HTMLElement;
  const tabBarContainer = document.getElementById('tab-bar') as HTMLElement;
  const statusBarContainer = document.getElementById('status-bar') as HTMLElement;
  const breadcrumbText = document.getElementById('breadcrumb-text') as HTMLElement;
  const emptyStateEl = document.getElementById('empty-state') as HTMLElement;
  const cmRoot = document.getElementById('codemirror-root') as HTMLElement;
  const markdownViewport = document.getElementById('markdown-viewport') as HTMLElement;
  const btnMdToggle = document.getElementById('btn-md-toggle') as HTMLElement;
  const mdToggleText = document.getElementById('md-toggle-text') as HTMLElement;
  const markdownViewer = new MarkdownViewerComponent(markdownViewport);

  btnMdToggle.addEventListener('click', () => {
    const nextMode = editorState.toggleActiveTabRenderMode();
    if (nextMode) {
      statusBar.showMessage(`Markdown: ${nextMode.toUpperCase()} mode`);
    }
  });

  const workspaceTitle = document.getElementById('workspace-title') as HTMLElement;

  const btnActExplorer = document.getElementById('btn-act-explorer') as HTMLElement;
  const btnActSearch = document.getElementById('btn-act-search') as HTMLElement;
  const btnActGit = document.getElementById('btn-act-git') as HTMLElement;

  // 4. Initialize Settings & Shortcuts Modals
  const settingsModal = new SettingsModalComponent({
    onVimToggled: (enabled) => {
      editorManager.toggleVim(enabled);
      statusBar.updateVimMode(vimIntegration.getCurrentMode());
      statusBar.showMessage(`Vim mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
  });

  const shortcutsModal = new ShortcutsModalComponent();

  // 5. Initialize Side Panes & Bottom Panels
  const searchPanel = new SearchPanelComponent(searchPane);
  const gitPanel = new GitPanelComponent(gitPane);
  const terminalPanel = new TerminalPanelComponent(bottomPanelEl);

  let activeSidebarPane: 'explorer' | 'search' | 'git' = 'explorer';

  function showSidebarPane(pane: 'explorer' | 'search' | 'git') {
    if (sidebarEl.classList.contains('collapsed')) {
      sidebarEl.classList.remove('collapsed');
    } else if (activeSidebarPane === pane) {
      sidebarEl.classList.add('collapsed');
      return;
    }

    activeSidebarPane = pane;
    explorerPane.style.display = pane === 'explorer' ? 'flex' : 'none';
    searchPane.style.display = pane === 'search' ? 'flex' : 'none';
    gitPane.style.display = pane === 'git' ? 'flex' : 'none';

    btnActExplorer.classList.toggle('active', pane === 'explorer');
    btnActSearch.classList.toggle('active', pane === 'search');
    btnActGit.classList.toggle('active', pane === 'git');

    if (pane === 'search') {
      searchPanel.focus();
    } else if (pane === 'git') {
      gitPanel.refresh();
    }
  }

  // Quick Pickers
  function openLanguagePicker() {
    const activeTab = editorState.getActiveTab();
    const items: PaletteItem[] = SUPPORTED_LANGUAGES.map(lang => ({
      id: lang.name,
      title: lang.name,
      detail: activeTab && activeTab.language === lang.name ? 'Currently Active' : 'Syntax Mode',
      category: 'Languages',
      action: () => {
        if (activeTab) {
          editorState.setTabLanguage(activeTab.id, lang.name);
          editorManager.setLanguageByName(lang.name);
          statusBar.showMessage(`Language: ${lang.name}`);
        }
      }
    }));
    commandPalette.open(items);
  }

  function openIndentationPicker() {
    const sizes = [2, 4, 8];
    const curSize = preferencesService.get('editor.tabSize') || 2;
    const items: PaletteItem[] = sizes.map(sz => ({
      id: `indent-${sz}`,
      title: `Indent Using Spaces: ${sz}`,
      detail: sz === curSize ? 'Currently Active' : 'Tab Size',
      category: 'Indentation',
      action: () => {
        preferencesService.set('editor.tabSize', sz);
        statusBar.showMessage(`Indentation set to ${sz} spaces`);
      }
    }));
    commandPalette.open(items);
  }

  // 6. Initialize Status Bar
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
    },
    onOpenLanguagePicker: () => {
      openLanguagePicker();
    },
    onOpenIndentationPicker: () => {
      openIndentationPicker();
    },
    onOpenGit: () => {
      showSidebarPane('git');
    }
  });

  // 7. Initialize Tab Bar
  new TabBarComponent(tabBarContainer);

  // Auto-Save Engine
  let autoSaveTimer: any = null;
  function triggerAutoSave() {
    const isAutoSave = preferencesService.get('files.autoSave');
    if (!isAutoSave) return;

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    const delay = preferencesService.get('files.autoSaveDelay') || 1000;
    autoSaveTimer = setTimeout(async () => {
      const activeTab = editorState.getActiveTab();
      if (activeTab && activeTab.isDirty && !activeTab.path.startsWith('Untitled-')) {
        try {
          const content = editorManager.getContent();
          await fsService.writeFile(activeTab.path, content);
          editorState.markSaved(activeTab.id, content);
          statusBar.showMessage(`Auto-saved ${activeTab.name}`);
        } catch (e) {
          console.warn('Auto-save failed:', e);
        }
      }
    }, delay);
  }

  // Save Active File handler
  async function saveActiveFile() {
    const activeTab = editorState.getActiveTab();
    if (!activeTab) return;

    if (activeTab.path.startsWith('Untitled-')) {
      return saveAsActiveFile();
    }

    try {
      const currentContent = editorManager.getContent();
      await fsService.writeFile(activeTab.path, currentContent);
      editorState.markSaved(activeTab.id, currentContent);
      statusBar.showMessage(`Saved ${activeTab.name}`);
    } catch (err) {
      alert(`Failed to save file: ${err}`);
    }
  }

  // Save As Active File handler
  async function saveAsActiveFile() {
    const activeTab = editorState.getActiveTab();
    const currentContent = editorManager.getContent();
    const defaultPath = activeTab && !activeTab.path.startsWith('Untitled-') ? activeTab.path : (fsService.getWorkspace() || '');

    const newPath = await fsService.saveFileDialog(defaultPath);
    if (!newPath) return;

    try {
      await fsService.writeFile(newPath, currentContent);
      if (activeTab) {
        editorState.renameTab(activeTab.id, newPath, currentContent);
      } else {
        editorState.openFile(newPath, currentContent);
      }
      const newName = newPath.split(/[/\\]/).pop() || newPath;
      statusBar.showMessage(`Saved as ${newName}`);

      const ws = fsService.getWorkspace();
      if (ws) {
        fileTree.loadWorkspace(ws);
      }
    } catch (err) {
      alert(`Failed to save file as "${newPath}": ${err}`);
    }
  }

  // Open file dialog handler
  async function openFilePicker() {
    const filePath = await fsService.openFileDialog();
    if (filePath) {
      try {
        const content = await fsService.readFile(filePath);
        editorState.openFile(filePath, content);
      } catch (err) {
        alert(`Failed to open file: ${err}`);
      }
    }
  }

  // Go to Line prompt handler
  function triggerGotoLine() {
    commandPalette.promptInput({
      placeholder: 'Go to line:column (e.g. 42 or 42:5)...',
      onAccept: (val) => {
        const parts = val.replace(':', ' ').trim().split(/\s+/);
        const line = parseInt(parts[0], 10);
        const col = parts[1] ? parseInt(parts[1], 10) : 1;
        if (!isNaN(line)) {
          editorManager.gotoLine(line, col);
        }
      }
    });
  }

  // 7. Initialize Title Bar & Top Nav
  const titleBar = new TitleBarComponent(titleBarContainer, {
    onNewFile: () => {
      editorState.openUntitledFile();
    },
    onOpenFile: () => {
      openFilePicker();
    },
    onOpenFolder: async () => {
      const folder = await fsService.selectFolder();
      if (folder) await loadWorkspace(folder);
    },
    onSave: () => {
      saveActiveFile();
    },
    onSaveAs: () => {
      saveAsActiveFile();
    },
    onToggleAutoSave: () => {
      const current = preferencesService.get('files.autoSave');
      preferencesService.set('files.autoSave', !current);
      statusBar.showMessage(`Auto Save ${!current ? 'ENABLED' : 'DISABLED'}`);
    },
    onOpenSettings: () => {
      settingsModal.open();
    },
    onOpenThemePicker: () => {
      openThemePicker();
    },
    onOpenCommandPalette: () => {
      openCommandPalette();
    },
    onQuickOpen: () => {
      openQuickFilePicker();
    },
    onToggleSidebar: () => {
      sidebarEl.classList.toggle('collapsed');
    },
    onCycleCursor: () => {
      const style = editorManager.cycleCursorStyle();
      statusBar.showMessage(`Cursor Style: ${style.toUpperCase()} (Saved as preference)`);
    },
    onUndo: () => {
      editorManager.undo();
    },
    onRedo: () => {
      editorManager.redo();
    },
    onSelectAll: () => {
      editorManager.selectAll();
    },
    onFind: () => {
      editorManager.openSearch();
    },
    onReplace: () => {
      editorManager.openSearch();
    },
    onToggleWordWrap: () => {
      const isWrap = editorManager.toggleWordWrap();
      statusBar.showMessage(`Word Wrap: ${isWrap ? 'ENABLED' : 'DISABLED'}`);
    },
    onGotoLine: () => {
      triggerGotoLine();
    },
    onToggleTerminal: () => {
      terminalPanel.toggle();
    },
    onOpenSearch: () => {
      showSidebarPane('search');
    },
    onOpenGit: () => {
      showSidebarPane('git');
    },
    onOpenShortcuts: () => {
      shortcutsModal.open();
    },
    onCheckUpdates: () => {
      settingsModal.open();
    },
    onAbout: () => {
      alert('Gitero IDE v0.0.3-alpha\nHigh-Performance Developer Studio with Native Neutralino Engine.\nZero emojis. Pure speed.');
    }
  });

  const updateAppTitle = (activeTab: EditorTab | null) => {
    const ws = fsService.getWorkspace();
    const wsName = ws ? ws.split(/[/\\]/).filter(Boolean).pop() : '';
    if (activeTab) {
      titleBar.updateTitle(`${activeTab.name} — ${wsName || 'Gitero IDE'} — Gitero IDE`);
    } else if (wsName) {
      titleBar.updateTitle(`${wsName} — Gitero IDE`);
    } else {
      titleBar.updateTitle('Gitero IDE');
    }
  };

  // 8. Initialize CodeMirror Editor
  editorManager.init(cmRoot, {
    initialContent: '',
    onContentChange: (newContent) => {
      const activeTab = editorState.getActiveTab();
      if (activeTab) {
        editorState.updateContent(activeTab.id, newContent);
        triggerAutoSave();
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

  // 9. Connect Vim Ex-Commands (:w, :q)
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

  // 10. Initialize File Tree
  const fileTree = new FileTreeComponent(fileTreeContainer, {
    onFileOpen: (filePath, content, options) => {
      // Opening from left sidebar -> always open in RAW mode per specification
      editorState.openFile(filePath, content, { viewMode: options?.viewMode || 'raw' });
    },
    onFindInFolder: () => {
      showSidebarPane('search');
    }
  });

  // 11. Listen to Editor State changes (active tab, dirty indicators, etc.)
  let currentLoadedTabId: string | null = null;

  editorState.onChange((tabs, activeTab) => {
    statusBar.updateTabInfo(activeTab);
    updateAppTitle(activeTab);

    if (!activeTab) {
      cmRoot.style.display = 'none';
      markdownViewport.style.display = 'none';
      btnMdToggle.style.display = 'none';
      emptyStateEl.style.display = 'flex';
      breadcrumbText.textContent = 'Gitero IDE';
      currentLoadedTabId = null;
      return;
    }

    emptyStateEl.style.display = 'none';
    breadcrumbText.textContent = activeTab.path.replace(/\\/g, ' > ').replace(/\//g, ' > ');

    const isMd = /\.md$/i.test(activeTab.path) || /\.markdown$/i.test(activeTab.path);

    if (isMd) {
      btnMdToggle.style.display = 'inline-flex';
      if (activeTab.viewMode === 'rendered') {
        cmRoot.style.display = 'none';
        markdownViewport.style.display = 'block';
        btnMdToggle.classList.add('active');
        mdToggleText.textContent = 'Edit Raw';
        markdownViewer.render(activeTab.content, activeTab.path);
      } else {
        markdownViewport.style.display = 'none';
        cmRoot.style.display = 'block';
        btnMdToggle.classList.remove('active');
        mdToggleText.textContent = 'Preview';
        if (currentLoadedTabId !== activeTab.id) {
          currentLoadedTabId = activeTab.id;
          editorManager.loadDocument(activeTab.content, activeTab.path);
        }
      }
    } else {
      btnMdToggle.style.display = 'none';
      markdownViewport.style.display = 'none';
      cmRoot.style.display = 'block';
      if (currentLoadedTabId !== activeTab.id) {
        currentLoadedTabId = activeTab.id;
        editorManager.loadDocument(activeTab.content, activeTab.path);
      }
    }
  });

  // 12. Workspace Loader
  async function loadWorkspace(dirPath: string) {
    fsService.setWorkspace(dirPath);
    const folderName = dirPath.split(/[/\\]/).filter(Boolean).pop() || dirPath;
    workspaceTitle.textContent = folderName.toUpperCase();
    await fileTree.loadWorkspace(dirPath);
    updateAppTitle(editorState.getActiveTab());
    terminalPanel.setCwd(dirPath);
    terminalPanel.logOutput(`Opened workspace folder: ${dirPath}`);
    gitPanel.refresh();
    statusBar.showMessage(`Opened folder: ${folderName}`);
  }

  // Load existing workspace or fallback
  const initialWorkspace = fsService.getWorkspace() || '.';
  loadWorkspace(initialWorkspace);

  // Check if Gitero was opened with an external file argument (e.g. Windows "Open with" or double-click)
  const checkExternalFileOpen = async (): Promise<boolean> => {
    try {
      const nlArgs = (window as any).NL_ARGS;
      if (Array.isArray(nlArgs)) {
        for (let i = 1; i < nlArgs.length; i++) {
          const arg = nlArgs[i];
          if (arg && !arg.startsWith('--') && !arg.startsWith('-') && !arg.startsWith('/')) {
            try {
              const content = await fsService.readFile(arg);
              const isMd = /\.md$/i.test(arg) || /\.markdown$/i.test(arg);
              // Opened externally / double-click in Windows -> open in rendered mode if markdown!
              editorState.openFile(arg, content, { viewMode: isMd ? 'rendered' : 'raw' });
              return true;
            } catch (e) {
              // Not a readable file path
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not check external file arguments:', err);
    }
    return false;
  };

  if ((window as any).Neutralino?.events) {
    (window as any).Neutralino.events.on('openedFile', async (evt: any) => {
      if (evt?.detail) {
        try {
          const path = evt.detail;
          const content = await fsService.readFile(path);
          const isMd = /\.md$/i.test(path) || /\.markdown$/i.test(path);
          editorState.openFile(path, content, { viewMode: isMd ? 'rendered' : 'raw' });
        } catch (e) {
          console.warn('Failed to open file via openedFile event:', e);
        }
      }
    });
  }

  const openedExternal = await checkExternalFileOpen();

  // If no tabs are open and no external file was opened, open a friendly README welcome
  if (!openedExternal && editorState.getTabs().length === 0) {
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
* **Ctrl + \`**: Toggle Integrated Terminal
* **Ctrl + Shift + F**: Search in Files
* **Ctrl + Shift + G**: Source Control (Git)
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
`,
      { viewMode: 'rendered' }
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

  btnActExplorer.addEventListener('click', () => {
    showSidebarPane('explorer');
  });

  btnActSearch.addEventListener('click', () => {
    showSidebarPane('search');
  });

  btnActGit.addEventListener('click', () => {
    showSidebarPane('git');
  });

  document.getElementById('btn-act-theme')?.addEventListener('click', () => {
    openThemePicker();
  });

  document.getElementById('btn-act-settings')?.addEventListener('click', () => {
    settingsModal.open();
  });

  // 14. Command Palette Handlers
  async function openQuickFilePicker() {
    const tabs = editorState.getTabs();
    const openTabPaths = new Set(tabs.map(t => t.path));
    const items: PaletteItem[] = tabs.map(t => ({
      id: t.id,
      title: t.name,
      detail: t.path,
      category: 'Open Tab',
      action: () => editorState.selectTab(t.id)
    }));

    const ws = fsService.getWorkspace();
    if (ws) {
      try {
        const allFiles = await fsService.scanAllFiles(ws, 1500);
        for (const file of allFiles) {
          if (openTabPaths.has(file)) continue;
          const fileName = file.split(/[/\\]/).pop() || file;
          const rel = file.startsWith(ws) ? file.slice(ws.length).replace(/^[/\\]/, '') : file;
          items.push({
            id: file,
            title: fileName,
            detail: rel,
            category: 'Workspace',
            action: async () => {
              try {
                const content = await fsService.readFile(file);
                editorState.openFile(file, content);
              } catch (err) {
                alert(`Could not open file: ${err}`);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Failed to scan workspace files for quick picker:', err);
      }
    }

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
        id: 'file.newFile',
        title: 'File: New File',
        detail: 'Ctrl+N',
        category: 'File',
        action: () => {
          const ws = fsService.getWorkspace() || '.';
          fileTree.promptCreateFile(ws);
        }
      },
      {
        id: 'file.openFile',
        title: 'File: Open File...',
        detail: 'Ctrl+O',
        category: 'File',
        action: () => openFilePicker()
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
        id: 'file.saveAs',
        title: 'File: Save As...',
        detail: 'Ctrl+Shift+S',
        category: 'File',
        action: () => saveAsActiveFile()
      },
      {
        id: 'file.toggleAutoSave',
        title: `File: Toggle Auto Save (${preferencesService.get('files.autoSave') ? 'Disable' : 'Enable'})`,
        category: 'File',
        action: () => {
          const cur = preferencesService.get('files.autoSave');
          preferencesService.set('files.autoSave', !cur);
          statusBar.showMessage(`Auto Save ${!cur ? 'ENABLED' : 'DISABLED'}`);
        }
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
        id: 'view.toggleWordWrap',
        title: 'View: Toggle Word Wrap',
        detail: 'Alt+Z',
        category: 'View',
        action: () => {
          const isWrap = editorManager.toggleWordWrap();
          statusBar.showMessage(`Word Wrap: ${isWrap ? 'ENABLED' : 'DISABLED'}`);
        }
      },
      {
        id: 'edit.find',
        title: 'Edit: Find',
        detail: 'Ctrl+F',
        category: 'Edit',
        action: () => editorManager.openSearch()
      },
      {
        id: 'edit.replace',
        title: 'Edit: Replace',
        detail: 'Ctrl+H',
        category: 'Edit',
        action: () => editorManager.openSearch()
      },
      {
        id: 'go.gotoLine',
        title: 'Go: Go to Line/Column...',
        detail: 'Ctrl+G',
        category: 'Go',
        action: () => triggerGotoLine()
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
      },
      {
        id: 'view.terminal',
        title: 'View: Toggle Integrated Terminal',
        detail: 'Ctrl+`',
        category: 'View',
        action: () => terminalPanel.toggle()
      },
      {
        id: 'view.search',
        title: 'View: Show Global Search in Files',
        detail: 'Ctrl+Shift+F',
        category: 'View',
        action: () => showSidebarPane('search')
      },
      {
        id: 'view.git',
        title: 'View: Show Source Control (Git)',
        detail: 'Ctrl+Shift+G',
        category: 'View',
        action: () => showSidebarPane('git')
      },
      {
        id: 'preferences.language',
        title: 'Preferences: Change Language Mode',
        category: 'Preferences',
        action: () => openLanguagePicker()
      },
      {
        id: 'preferences.indentation',
        title: 'Preferences: Change Tab Size (Indentation)',
        category: 'Preferences',
        action: () => openIndentationPicker()
      },
      {
        id: 'help.shortcuts',
        title: 'Help: Keyboard Shortcuts Reference',
        detail: 'Ctrl+K Ctrl+S',
        category: 'Help',
        action: () => shortcutsModal.open()
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
  function matchesKeybinding(e: KeyboardEvent, shortcutStr: string): boolean {
    if (!shortcutStr) return false;
    const parts = shortcutStr.split('+').map(p => p.trim().toLowerCase());
    const hasCtrl = parts.includes('ctrl') || parts.includes('control');
    const hasShift = parts.includes('shift');
    const hasAlt = parts.includes('alt');
    const hasMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('win');

    if (e.ctrlKey !== hasCtrl) return false;
    if (e.shiftKey !== hasShift) return false;
    if (e.altKey !== hasAlt) return false;
    if (e.metaKey !== hasMeta) return false;

    const keyPart = parts.find(p => !['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd', 'win'].includes(p));
    if (!keyPart) return false;

    const eventKey = e.key.toLowerCase();
    if (keyPart === 'space' && (eventKey === ' ' || eventKey === 'space')) return true;
    if (keyPart === '`' && (eventKey === '`' || eventKey === '~')) return true;
    if (keyPart === ',' && eventKey === ',') return true;

    return eventKey === keyPart;
  }

  let isCtrlK = false;
  let ctrlKTimer: any = null;

  window.addEventListener('keydown', (e) => {
    // Ctrl + K chord handling
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      isCtrlK = true;
      clearTimeout(ctrlKTimer);
      ctrlKTimer = setTimeout(() => { isCtrlK = false; }, 1500);
      return;
    }

    if (isCtrlK) {
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        isCtrlK = false;
        shortcutsModal.open();
        return;
      }
      if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        isCtrlK = false;
        fsService.selectFolder().then(f => {
          if (f) loadWorkspace(f);
        });
        return;
      }
      isCtrlK = false;
    }

    const matchAction = (actionId: string) => {
      const binding = preferencesService.getKeybinding(actionId);
      return matchesKeybinding(e, binding);
    };

    // Toggle Integrated Terminal
    if (matchAction('workbench.action.terminal.toggleTerminal')) {
      e.preventDefault();
      terminalPanel.toggle();
      return;
    }

    // Global Search in Files
    if (matchAction('workbench.action.findInFiles')) {
      e.preventDefault();
      showSidebarPane('search');
      return;
    }

    // Git Source Control
    if (matchAction('workbench.view.scm')) {
      e.preventDefault();
      showSidebarPane('git');
      return;
    }

    // Quick Open File
    if (matchAction('workbench.action.quickOpen')) {
      e.preventDefault();
      openQuickFilePicker();
      return;
    }

    // Command Palette
    if (matchAction('workbench.action.showCommands') || e.key === 'F1') {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    // Save As
    if (matchAction('workbench.action.files.saveAs')) {
      e.preventDefault();
      saveAsActiveFile();
      return;
    }

    // Save Active File
    if (matchAction('workbench.action.files.save')) {
      e.preventDefault();
      saveActiveFile();
      return;
    }

    // Open File
    if (matchAction('workbench.action.files.openFile')) {
      e.preventDefault();
      openFilePicker();
      return;
    }

    // New Untitled File
    if (matchAction('workbench.action.files.newUntitledFile')) {
      e.preventDefault();
      editorState.openUntitledFile();
      return;
    }

    // Go to Line/Column
    if (matchAction('workbench.action.gotoLine')) {
      e.preventDefault();
      triggerGotoLine();
      return;
    }

    // Toggle Word Wrap
    if (matchAction('editor.action.toggleWordWrap')) {
      e.preventDefault();
      const isWrap = editorManager.toggleWordWrap();
      statusBar.showMessage(`Word Wrap: ${isWrap ? 'ENABLED' : 'DISABLED'}`);
      return;
    }

    // Toggle Sidebar Visibility
    if (matchAction('workbench.action.toggleSidebarVisibility')) {
      e.preventDefault();
      sidebarEl.classList.toggle('collapsed');
      return;
    }

    // Toggle Markdown Preview / Raw
    if (matchAction('markdown.showPreview')) {
      e.preventDefault();
      const nextMode = editorState.toggleActiveTabRenderMode();
      if (nextMode) {
        statusBar.showMessage(`Markdown: ${nextMode.toUpperCase()} mode`);
      }
      return;
    }

    // Open Settings
    if (matchAction('workbench.action.openSettings')) {
      e.preventDefault();
      settingsModal.open();
      return;
    }

    // Close Active Tab
    if (matchAction('workbench.action.closeActiveEditor')) {
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
