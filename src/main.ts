import { initNeutralino, isNative } from './services/neutralino';
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
import { GitGraphFullComponent } from './ui/gitGraph';
import { TerminalPanelComponent } from './ui/terminalPanel';
import { ShortcutsModalComponent } from './ui/shortcutsModal';
import { SUPPORTED_LANGUAGES, isImageFile, isBinaryFile, detectLanguage } from './editor/languages';
import { MarkdownViewerComponent } from './ui/markdownViewer';
import { MediaViewerComponent } from './ui/mediaViewer';
import { gitService } from './services/git';
import { WindowResizer } from './ui/windowResizer';
import { getFileIconSvg } from './ui/icons';
import { SNIPPETS } from './editor/snippets';
import { fileAssociationService } from './services/fileAssociation';
import { persistentStorage } from './services/storage';
import { transparencyService } from './services/transparencyService';
import { lspClient } from './services/lsp/lspClient';
import { NotificationToastComponent } from './ui/notificationToast';
import { NotificationCenterComponent } from './ui/notificationCenter';
import { notificationService } from './services/notification';
import { checkMissingLsp } from './services/lsp/lspDetector';
import { DISPLAY_VERSION } from './version';

async function bootstrap() {
  console.log('[Gitero IDE] Bootstrapping...');
  const startTime = performance.now();

  // 1. Initialize native platform (if running in Neutralino binary)
  await initNeutralino();
  if (isNative() && (window as any).Neutralino?.os?.execCommand) {
    const nlPath = (window as any).NL_PATH || '.';
    const hotkeyCmd = `"${nlPath}\\bin\\gitero_explorer_hotkey.exe"`;
    (window as any).Neutralino.os.execCommand(hotkeyCmd, { background: true }).catch(() => {});
  }
  await persistentStorage.init();
  preferencesService.reload();
  const initialWs = fsService.reloadWorkspaceFromStorage();
  if (initialWs) {
    editorState.setWorkspace(initialWs);
    lspClient.setWorkspaceRoot(initialWs);
  } else {
    editorState.reloadPersistedTabs();
    if (typeof window !== 'undefined' && (window as any).NL_PATH) {
      lspClient.setWorkspaceRoot((window as any).NL_PATH);
    }
  }
  new WindowResizer();

  // 2. Initialize Themes, User CSS, and Transparency Engine
  themeManager.init();
  transparencyService.init();

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

  // Initialize Window Border Radius from preferences
  const applyWindowBorderRadius = () => {
    let radius = preferencesService.get('workbench.windowBorderRadius');
    if (radius === undefined || radius === 13 || radius === 10) {
      radius = 8;
      preferencesService.set('workbench.windowBorderRadius', 8);
    }
    document.documentElement.style.setProperty('--window-border-radius', `${radius}px`);
  };
  applyWindowBorderRadius();
  preferencesService.subscribe('workbench.windowBorderRadius', applyWindowBorderRadius);

  // Initialize Sidebar Width from preferences
  const sidebarEl = document.getElementById('sidebar') as HTMLElement;
  const applySidebarWidth = () => {
    const width = preferencesService.get('workbench.sidebarWidth') || 260;
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    if (sidebarEl && !sidebarEl.classList.contains('collapsed')) {
      sidebarEl.style.width = `${width}px`;
    }
  };
  applySidebarWidth();
  preferencesService.subscribe('workbench.sidebarWidth', applySidebarWidth);

  // 3. UI DOM References
  const titleBarContainer = document.getElementById('app-titlebar') as HTMLElement;
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
  const mediaViewport = document.getElementById('media-viewport') as HTMLElement;
  const btnMdToggle = document.getElementById('btn-md-toggle') as HTMLElement;
  const mdToggleText = document.getElementById('md-toggle-text') as HTMLElement;
  const markdownViewer = new MarkdownViewerComponent(markdownViewport);
  const mediaViewer = new MediaViewerComponent(mediaViewport);

  const sidebarResizerEl = document.getElementById('sidebar-resizer') as HTMLElement;
  const btnOpenFolder = document.getElementById('btn-open-folder') as HTMLElement;
  const btnOpenFolderHeader = document.getElementById('btn-open-folder-header') as HTMLElement;
  const sidebarSearchContainer = document.getElementById('sidebar-workspace-search-container') as HTMLElement;
  const sidebarSearchInput = document.getElementById('sidebar-file-search-input') as HTMLInputElement;
  const sidebarSearchClear = document.getElementById('sidebar-search-clear') as HTMLElement;
  const sidebarSearchSuggestions = document.getElementById('sidebar-search-suggestions') as HTMLElement;

  // 3b. Setup Resizable Sidebar Dragging
  if (sidebarResizerEl) {
    let isResizingSidebar = false;
    let startX = 0;
    let startWidth = 0;

    sidebarResizerEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || sidebarEl.classList.contains('collapsed')) return;
      e.preventDefault();
      e.stopPropagation();
      isResizingSidebar = true;
      startX = e.clientX;
      startWidth = sidebarEl.getBoundingClientRect().width;
      sidebarEl.classList.add('resizing');
      sidebarResizerEl.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizingSidebar) return;
      const deltaX = e.clientX - startX;
      const minW = 160;
      const maxW = Math.max(minW, Math.min(window.innerWidth - 250, 800));
      const newWidth = Math.round(Math.max(minW, Math.min(maxW, startWidth + deltaX)));
      sidebarEl.style.width = `${newWidth}px`;
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
    });

    window.addEventListener('mouseup', () => {
      if (isResizingSidebar) {
        isResizingSidebar = false;
        sidebarEl.classList.remove('resizing');
        sidebarResizerEl.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        const finalWidth = Math.round(sidebarEl.getBoundingClientRect().width);
        preferencesService.set('workbench.sidebarWidth', finalWidth);
      }
    });
  }

  btnMdToggle.addEventListener('click', () => {
    const nextMode = editorState.toggleActiveTabRenderMode();
    if (nextMode) {
      statusBar.showMessage(`Markdown: ${nextMode.toUpperCase()} mode`);
    }
  });

  const ICON_MINIMAP_VISIBLE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="2" width="13" height="12" rx="1.5"/><line x1="10.5" y1="2" x2="10.5" y2="14" stroke-opacity="0.6"/><rect x="10.5" y="2" width="4" height="12" fill="currentColor" fill-opacity="0.18" stroke="none"/><line x1="12" y1="4.5" x2="13.5" y2="4.5" stroke-linecap="round" stroke-width="1"/><line x1="12" y1="7" x2="13.5" y2="7" stroke-linecap="round" stroke-width="1"/><line x1="12" y1="9.5" x2="13.5" y2="9.5" stroke-linecap="round" stroke-width="1"/></svg>';
  const ICON_MINIMAP_HIDDEN = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="1.5" y="2" width="13" height="12" rx="1.5"/><line x1="10.5" y1="2.5" x2="10.5" y2="13.5" stroke-dasharray="1.5 1.5" stroke-opacity="0.35"/></svg>';

  const btnMinimapToggle = document.getElementById('btn-minimap-toggle') as HTMLElement;
  const updateMinimapBtn = (enabled: boolean) => {
    if (!btnMinimapToggle) return;
    btnMinimapToggle.innerHTML = enabled ? ICON_MINIMAP_VISIBLE : ICON_MINIMAP_HIDDEN;
    btnMinimapToggle.setAttribute('title', enabled ? 'Hide Minimap' : 'Show Minimap');
    btnMinimapToggle.setAttribute('aria-label', enabled ? 'Hide Minimap' : 'Show Minimap');
  };

  if (btnMinimapToggle) {
    updateMinimapBtn(preferencesService.get('editor.minimap.enabled') !== false);

    btnMinimapToggle.addEventListener('click', () => {
      const nextState = editorManager.toggleMinimap();
      updateMinimapBtn(nextState);
      statusBar.showMessage(`Minimap: ${nextState ? 'Expanded' : 'Collapsed'}`);
    });

    preferencesService.subscribe('editor.minimap.enabled', (enabled) => {
      updateMinimapBtn(enabled);
    });
  }

  const workspaceTitle = document.getElementById('workspace-title') as HTMLElement;

  const btnActExplorer = document.getElementById('btn-act-explorer') as HTMLElement;
  const btnActSearch = document.getElementById('btn-act-search') as HTMLElement;
  const btnActGit = document.getElementById('btn-act-git') as HTMLElement;

  // 4. Initialize Settings & Shortcuts Modals
  const settingsModal = new SettingsModalComponent({
    onVimToggled: (enabled) => {
      editorManager.toggleVim(enabled);
      statusBar.updateVimMode(vimIntegration.getCurrentMode());
      statusBar.showMessage(`Editing Mode: ${enabled ? 'Vim Mode' : 'Standard Text Mode'}`);
    }
  });

  const shortcutsModal = new ShortcutsModalComponent();
  new NotificationToastComponent();
  const notificationCenter = new NotificationCenterComponent();

  window.addEventListener('gitero:open-settings', (e: any) => {
    settingsModal.open(e.detail?.tab || 'editor');
  });

  // 5. Initialize Side Panes & Bottom Panels
  const searchPanel = new SearchPanelComponent(searchPane);
  const terminalPanel = new TerminalPanelComponent(bottomPanelEl);

  const gitGraphViewport = document.getElementById('git-graph-viewport') as HTMLElement;
  const fullGitGraph = new GitGraphFullComponent(gitGraphViewport);

  function openGitGraphTab() {
    editorState.openCustomTab('gitero://git-graph', 'Git Graph', 'git-graph');
  }

  // Auto-refresh full git graph if the tab is open in the workspace
  gitService.onRepositoryChange(() => {
    const isGraphOpen = editorState.getTabs().some(
      (t) => t.viewMode === 'git-graph' || t.id === 'gitero://git-graph'
    );
    if (isGraphOpen) {
      fullGitGraph.reload();
    }
  });

  // Hook Git output stream to the terminal/output console
  gitService.onOutput((line, level) => {
    terminalPanel.logOutput(line, level);
  });

  const gitPanel = new GitPanelComponent(gitPane, {
    onOpenGitGraph: () => openGitGraphTab(),
    onShowGitOutput: () => {
      terminalPanel.toggle(true);
      const outBtn = document.getElementById('tab-btn-output') as HTMLElement;
      outBtn?.click();
    }
  });

  let activeSidebarPane: 'explorer' | 'search' | 'git' = (preferencesService.get('workbench.activeSidebarPane') as 'explorer' | 'search' | 'git') || 'explorer';

  function showSidebarPane(pane: 'explorer' | 'search' | 'git') {
    if (sidebarEl.classList.contains('collapsed')) {
      sidebarEl.classList.remove('collapsed');
      const savedWidth = preferencesService.get('workbench.sidebarWidth') || 260;
      sidebarEl.style.width = `${savedWidth}px`;
      preferencesService.set('workbench.sidebarVisible', true);
    } else if (activeSidebarPane === pane) {
      sidebarEl.classList.add('collapsed');
      sidebarEl.style.width = '';
      preferencesService.set('workbench.sidebarVisible', false);
      return;
    }

    activeSidebarPane = pane;
    preferencesService.set('workbench.activeSidebarPane', pane);
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

  // Helper to detect if Gitero was launched directly with an external file argument
  const hasExternalFileArg = (): boolean => {
    try {
      const nlArgs = (window as any).NL_ARGS;
      if (Array.isArray(nlArgs)) {
        const noExtFiles = ['dockerfile', 'makefile', 'license', 'procfile', 'gemfile', 'readme'];
        for (let i = 1; i < nlArgs.length; i++) {
          const a = nlArgs[i];
          if (!a || a === '.' || a.startsWith('-') || a.startsWith('/')) continue;
          const base = a.split(/[/\\]/).pop()?.toLowerCase() || '';
          if (base && (base.includes('.') || noExtFiles.includes(base))) return true;
        }
      }
    } catch {}
    return false;
  };

  const isExternalFileBoot = document.documentElement.classList.contains('init-sidebar-collapsed') || hasExternalFileArg();

  // Restore sidebar visibility & active pane from preferences (or keep collapsed if opening external file)
  if (isExternalFileBoot || !preferencesService.get('workbench.sidebarVisible')) {
    sidebarEl.classList.add('collapsed');
    sidebarEl.style.width = '';
  } else {
    sidebarEl.classList.remove('collapsed');
    const savedWidth = preferencesService.get('workbench.sidebarWidth') || 260;
    sidebarEl.style.width = `${savedWidth}px`;
  }
  if (activeSidebarPane !== 'explorer') {
    showSidebarPane(activeSidebarPane);
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

  // Git Branch Picker via Command Palette
  async function openBranchPicker() {
    if (!gitService.isGitRepo()) {
      statusBar.showMessage('Not a Git repository');
      return;
    }

    const branches = await gitService.getBranches();
    const items: PaletteItem[] = [
      {
        id: 'git.branch.create',
        title: '+ Create new branch...',
        detail: 'Create and checkout a new Git branch',
        category: 'Git',
        action: () => {
          commandPalette.promptInput({
            placeholder: 'Branch name...',
            onAccept: async (val) => {
              if (val.trim()) {
                const res = await gitService.createAndCheckoutBranch(val.trim());
                if (res.success) {
                  statusBar.showMessage(`Switched to new branch: ${val.trim()}`);
                } else {
                  alert(`Failed to create branch: ${res.error}`);
                }
              }
            }
          });
        }
      }
    ];

    branches.forEach((b) => {
      items.push({
        id: `git.branch.${b.name}`,
        title: `${b.name} ${b.isCurrent ? '(current)' : ''}`,
        detail: b.isCurrent ? 'Current active branch' : 'Checkout branch',
        category: 'Git Branches',
        action: async () => {
          if (!b.isCurrent) {
            const res = await gitService.checkoutBranch(b.name);
            if (res.success) {
              statusBar.showMessage(`Switched to branch: ${b.name}`);
            } else {
              alert(`Failed to checkout branch: ${res.error}`);
            }
          }
        }
      });
    });

    commandPalette.open(items);
  }

  // Git Sync
  async function syncGit() {
    if (!gitService.isGitRepo()) {
      statusBar.showMessage('Not a Git repository');
      return;
    }
    statusBar.showMessage('Syncing with remote repository...');
    const res = await gitService.push();
    if (res.success) {
      statusBar.showMessage('Git: Successfully synced with remote');
      notificationService.success('Git Synced', 'Successfully synchronized local branch with remote repository.');
    } else {
      statusBar.showMessage(`Git sync error: ${res.error || 'Failed'}`);
      notificationService.error(
        'Git Sync Failed',
        res.error || 'Failed to push changes to remote repository.',
        [
          {
            label: 'View Output',
            primary: true,
            onClick: () => {
              terminalPanel.toggle(true);
              const outBtn = document.getElementById('tab-btn-output') as HTMLElement;
              outBtn?.click();
            }
          }
        ]
      );
    }
  }

  // 6. Initialize Status Bar
  const statusBar = new StatusBarComponent(statusBarContainer, {
    onToggleVim: () => {
      const next = !vimIntegration.isEnabled();
      vimIntegration.setEnabled(next);
      editorManager.toggleVim(next);
      statusBar.updateVimMode(vimIntegration.getCurrentMode());
      statusBar.showMessage(`Editing Mode: ${next ? 'Vim Mode' : 'Standard Text Mode'}`);
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
    onOpenLspSettings: () => {
      settingsModal.open('lsp');
    },
    onOpenGit: () => {
      showSidebarPane('git');
    },
    onSwitchBranch: () => {
      openBranchPicker();
    },
    onSyncGit: () => {
      syncGit();
    },
    onToggleNotifications: () => {
      notificationCenter.toggle();
    }
  });

  // 7. Initialize Tab Bar
  new TabBarComponent(tabBarContainer);

  // Formatting on save helper
  function formatContentForSave(rawContent: string): string {
    let content = rawContent;
    if (preferencesService.get('editor.trimTrailingWhitespace')) {
      content = content.replace(/[ \t]+$/gm, '');
    }
    if (preferencesService.get('editor.insertFinalNewline')) {
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }
    }
    return content;
  }

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
          let content = editorManager.getContent();
          const formatted = formatContentForSave(content);
          if (formatted !== content) {
            editorManager.setContent(formatted);
            content = formatted;
          }
          await fsService.writeFile(activeTab.path, content);
          editorState.markSaved(activeTab.id, content);
          editorManager.notifyDidSave();
          statusBar.showMessage(`Auto-saved ${activeTab.name}`);
          gitService.refresh();
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
      let currentContent = editorManager.getContent();
      const formatted = formatContentForSave(currentContent);
      if (formatted !== currentContent) {
        editorManager.setContent(formatted);
        currentContent = formatted;
      }
      await fsService.writeFile(activeTab.path, currentContent);
      editorState.markSaved(activeTab.id, currentContent);
      editorManager.notifyDidSave();
      statusBar.showMessage(`Saved ${activeTab.name}`);
      gitService.refresh();
    } catch (err) {
      alert(`Failed to save file: ${err}`);
    }
  }

  // Save As Active File handler
  async function saveAsActiveFile() {
    const activeTab = editorState.getActiveTab();
    let currentContent = editorManager.getContent();
    const formatted = formatContentForSave(currentContent);
    if (formatted !== currentContent) {
      editorManager.setContent(formatted);
      currentContent = formatted;
    }
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
      editorManager.notifyDidSave();
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

  // Full Screen Toggle handler
  async function toggleFullScreen() {
    if (isNative() && window.Neutralino?.window) {
      try {
        const isFull = await window.Neutralino.window.isFullScreen();
        if (isFull) {
          await window.Neutralino.window.exitFullScreen();
          document.body.classList.remove('window-fullscreen');
        } else {
          await window.Neutralino.window.setFullScreen();
          document.body.classList.add('window-fullscreen');
        }
      } catch (e) {
        console.warn('Failed to toggle fullscreen in native mode:', e);
      }
    } else {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.().catch(() => {});
        document.body.classList.add('window-fullscreen');
      } else {
        await document.exitFullscreen?.().catch(() => {});
        document.body.classList.remove('window-fullscreen');
      }
    }
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
    onOpenRecent: () => {
      openRecentWorkspacesPicker();
    },
    onOpenWorkspace: async (dirPath: string) => {
      await loadWorkspace(dirPath);
    },
    onClearRecentWorkspaces: () => {
      preferencesService.set('workbench.recentWorkspaces', []);
      statusBar.showMessage('Recent workspaces cleared');
    },
    onReopenClosedEditor: () => {
      const reopened = editorState.reopenClosedTab();
      if (reopened) {
        statusBar.showMessage(`Reopened: ${reopened.name}`);
      }
    },
    canReopenClosedEditor: () => {
      return editorState.canReopenClosedTab();
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
    onCloseActiveEditor: () => {
      const active = editorState.getActiveTab();
      if (active) editorState.closeTab(active.id);
    },
    onCloseAllEditors: () => {
      editorState.closeAllTabs();
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
      const isNowCollapsed = !sidebarEl.classList.contains('collapsed');
      if (isNowCollapsed) {
        sidebarEl.classList.add('collapsed');
        sidebarEl.style.width = '';
        preferencesService.set('workbench.sidebarVisible', false);
      } else {
        sidebarEl.classList.remove('collapsed');
        const savedWidth = preferencesService.get('workbench.sidebarWidth') || 260;
        sidebarEl.style.width = `${savedWidth}px`;
        preferencesService.set('workbench.sidebarVisible', true);
      }
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
      editorManager.openReplace();
    },
    onToggleWordWrap: () => {
      const isWrap = editorManager.toggleWordWrap();
      statusBar.showMessage(`Word Wrap: ${isWrap ? 'ENABLED' : 'DISABLED'}`);
    },
    onToggleIndentGuides: () => {
      const isGuides = editorManager.toggleIndentGuides();
      statusBar.showMessage(`Indentation Guides: ${isGuides ? 'ENABLED' : 'DISABLED'}`);
    },
    onToggleMinimap: () => {
      const isMinimap = editorManager.toggleMinimap();
      statusBar.showMessage(`Minimap: ${isMinimap ? 'ENABLED' : 'DISABLED'}`);
    },
    onToggleOverviewRuler: () => {
      const isRuler = editorManager.toggleOverviewRuler();
      statusBar.showMessage(`Scrollbar Overview Ruler: ${isRuler ? 'ENABLED' : 'DISABLED'}`);
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
    onToggleFullScreen: () => {
      toggleFullScreen();
    },
    onToggleDevTools: () => {
      statusBar.showMessage('Developer Tools: Press F12 or Ctrl+Shift+I (or right-click -> Inspect)');
    },
    onCheckUpdates: () => {
      settingsModal.open('updates');
    },
    onAbout: () => {
      alert(`Gitero IDE ${DISPLAY_VERSION}\nHigh-Performance Developer Studio with Native Neutralino Engine.\nZero emojis. Pure speed.`);
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
    },
    onNavigateToLocation: async (targetPath, line, col) => {
      const activeTab = editorState.getActiveTab();
      if (activeTab && activeTab.path.toLowerCase() === targetPath.toLowerCase()) {
        editorManager.gotoLine(line, col);
      } else {
        try {
          const content = await fsService.readFile(targetPath);
          editorState.openFile(targetPath, content, { viewMode: 'raw' });
          setTimeout(() => {
            editorManager.gotoLine(line, col);
          }, 80);
        } catch (err) {
          console.warn('Failed to open definition target:', err);
        }
      }
    }
  });

  // Notify LSP when tabs close
  editorState.onClose((closedTab) => {
    editorManager.notifyDidClose(closedTab.path, closedTab.language);
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
      mediaViewport.style.display = 'none';
      gitGraphViewport.style.display = 'none';
      btnMdToggle.style.display = 'none';
      emptyStateEl.style.display = 'flex';
      breadcrumbText.textContent = 'Gitero IDE';
      currentLoadedTabId = null;
      return;
    }

    emptyStateEl.style.display = 'none';
    breadcrumbText.textContent = activeTab.path.replace(/\\/g, ' > ').replace(/\//g, ' > ');

    if (activeTab.viewMode === 'git-graph' || activeTab.id === 'gitero://git-graph') {
      cmRoot.style.display = 'none';
      markdownViewport.style.display = 'none';
      mediaViewport.style.display = 'none';
      gitGraphViewport.style.display = 'block';
      btnMdToggle.style.display = 'none';
      breadcrumbText.textContent = 'Gitero IDE > Git Graph (Complete Tree)';
      fullGitGraph.reload();
      currentLoadedTabId = null;
      return;
    }

    gitGraphViewport.style.display = 'none';

    if (activeTab.viewMode === 'image') {
      cmRoot.style.display = 'none';
      markdownViewport.style.display = 'none';
      mediaViewport.style.display = 'block';
      btnMdToggle.style.display = 'none';
      mediaViewer.renderImage(activeTab.path);
      currentLoadedTabId = null;
    } else if (activeTab.viewMode === 'binary') {
      cmRoot.style.display = 'none';
      markdownViewport.style.display = 'none';
      mediaViewport.style.display = 'block';
      btnMdToggle.style.display = 'none';
      mediaViewer.renderBinary(activeTab.path);
      currentLoadedTabId = null;
    } else if (/\.md$/i.test(activeTab.path) || /\.markdown$/i.test(activeTab.path)) {
      mediaViewport.style.display = 'none';
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
      mediaViewport.style.display = 'none';
      cmRoot.style.display = 'block';
      if (currentLoadedTabId !== activeTab.id) {
        currentLoadedTabId = activeTab.id;
        editorManager.loadDocument(activeTab.content, activeTab.path);
        checkMissingLsp(activeTab.path, activeTab.language, (ext, lang) => {
          settingsModal.openWithAddServer(ext, lang);
        });
      }
    }

    if (btnMinimapToggle) {
      btnMinimapToggle.style.display = cmRoot.style.display === 'block' ? 'inline-flex' : 'none';
    }
  });

  function isUnopenedOrAppInstallDir(wsPath: string | null): boolean {
    if (!wsPath) return true;
    const clean = wsPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    if (clean === '.' || clean === '') {
      const saved = localStorage.getItem('gitero_workspace_path');
      if (!saved) return true;
    }
    const nlPath = ((window as any).NL_PATH || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    if (nlPath && clean === nlPath) {
      const saved = localStorage.getItem('gitero_workspace_path');
      if (!saved) return true;
    }
    return false;
  }

  function updateSidebarWorkspaceUi() {
    const ws = fsService.getWorkspace();
    const isUnopened = isUnopenedOrAppInstallDir(ws);
    if (btnOpenFolder) {
      btnOpenFolder.style.display = isUnopened ? 'flex' : 'none';
    }
    if (sidebarSearchContainer) {
      sidebarSearchContainer.style.display = isUnopened ? 'none' : 'flex';
    }
    if (isUnopened && sidebarSearchSuggestions) {
      sidebarSearchSuggestions.style.display = 'none';
    }
  }

  let currentSearchMatches: Array<{ path: string; name: string; rel: string }> = [];
  let selectedSearchIndex = -1;
  let searchDebounceTimer: any = null;

  function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function highlightMatches(text: string, query: string): string {
    if (!query) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const escapedQuery = escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapedText.replace(regex, '<span class="sidebar-search-match">$1</span>');
  }

  async function openWorkspaceFileFromSearch(filePath: string) {
    try {
      if (isImageFile(filePath)) {
        editorState.openBinaryFile(filePath, 'image');
      } else if (isBinaryFile(filePath)) {
        editorState.openBinaryFile(filePath, 'binary');
      } else {
        const content = await fsService.readFile(filePath);
        const isMd = /\.md$/i.test(filePath) || /\.markdown$/i.test(filePath);
        editorState.openFile(filePath, content, { viewMode: isMd ? 'rendered' : 'raw' });
      }
      if (sidebarSearchInput) {
        sidebarSearchInput.value = '';
      }
      if (sidebarSearchClear) {
        sidebarSearchClear.style.display = 'none';
      }
      if (sidebarSearchSuggestions) {
        sidebarSearchSuggestions.style.display = 'none';
        sidebarSearchSuggestions.innerHTML = '';
      }
      currentSearchMatches = [];
      selectedSearchIndex = -1;
    } catch (err) {
      alert(`Could not open file: ${err}`);
    }
  }

  async function performSidebarFileSearch() {
    if (!sidebarSearchInput || !sidebarSearchSuggestions) return;
    const q = sidebarSearchInput.value.trim().toLowerCase();
    if (!q) {
      if (sidebarSearchClear) sidebarSearchClear.style.display = 'none';
      sidebarSearchSuggestions.style.display = 'none';
      sidebarSearchSuggestions.innerHTML = '';
      currentSearchMatches = [];
      selectedSearchIndex = -1;
      return;
    }

    if (sidebarSearchClear) sidebarSearchClear.style.display = 'flex';
    const ws = fsService.getWorkspace();
    if (!ws) return;

    try {
      const files = await fsService.getWorkspaceFiles(ws);
      const isExt = q.startsWith('.');
      const matches: Array<{ path: string; name: string; rel: string; score: number }> = [];

      for (const file of files) {
        const name = file.split(/[/\\]/).pop() || file;
        const nameLower = name.toLowerCase();
        const rel = file.startsWith(ws) ? file.slice(ws.length).replace(/^[/\\]/, '') : file;
        const relLower = rel.toLowerCase();

        let score = -1;
        if (nameLower === q) score = 100;
        else if (nameLower.startsWith(q)) score = 80;
        else if (isExt && nameLower.endsWith(q)) score = 75;
        else if (nameLower.includes(q)) score = 60;
        else if (relLower.includes(q)) score = 40;

        if (score >= 0) {
          matches.push({ path: file, name, rel, score });
        }
      }

      // Sort by score desc, then alphabetical
      matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
      currentSearchMatches = matches.map(m => ({ path: m.path, name: m.name, rel: m.rel }));
      selectedSearchIndex = -1;

      sidebarSearchSuggestions.innerHTML = '';
      if (currentSearchMatches.length === 0) {
        const noRes = document.createElement('div');
        noRes.className = 'sidebar-search-no-results';
        noRes.textContent = `No files found matching "${q}"`;
        sidebarSearchSuggestions.appendChild(noRes);
      } else {
        currentSearchMatches.forEach((item, idx) => {
          const row = document.createElement('div');
          row.className = 'sidebar-search-suggestion-item';
          row.setAttribute('data-index', String(idx));

          const iconSpan = document.createElement('span');
          iconSpan.className = 'sidebar-search-item-icon';
          iconSpan.innerHTML = getFileIconSvg(item.name, false);

          const infoDiv = document.createElement('div');
          infoDiv.className = 'sidebar-search-item-info';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'sidebar-search-item-name';
          nameSpan.innerHTML = highlightMatches(item.name, q);

          const pathSpan = document.createElement('span');
          pathSpan.className = 'sidebar-search-item-path';
          pathSpan.textContent = item.rel;

          infoDiv.appendChild(nameSpan);
          infoDiv.appendChild(pathSpan);
          row.appendChild(iconSpan);
          row.appendChild(infoDiv);

          row.addEventListener('mousedown', (e) => {
            e.preventDefault();
            openWorkspaceFileFromSearch(item.path);
          });

          sidebarSearchSuggestions.appendChild(row);
        });
      }

      sidebarSearchSuggestions.style.display = 'block';
    } catch (err) {
      console.warn('Failed to search workspace files:', err);
    }
  }

  function updateSuggestionSelection() {
    if (!sidebarSearchSuggestions) return;
    const items = sidebarSearchSuggestions.querySelectorAll('.sidebar-search-suggestion-item');
    items.forEach((el, idx) => {
      if (idx === selectedSearchIndex) {
        el.classList.add('active');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(performSidebarFileSearch, 80);
    });

    sidebarSearchInput.addEventListener('keydown', (e) => {
      if (!sidebarSearchSuggestions || sidebarSearchSuggestions.style.display === 'none' || currentSearchMatches.length === 0) {
        if (e.key === 'Escape') {
          sidebarSearchInput.value = '';
          if (sidebarSearchClear) sidebarSearchClear.style.display = 'none';
          if (sidebarSearchSuggestions) sidebarSearchSuggestions.style.display = 'none';
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSearchIndex = (selectedSearchIndex + 1) % currentSearchMatches.length;
        updateSuggestionSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSearchIndex = (selectedSearchIndex - 1 + currentSearchMatches.length) % currentSearchMatches.length;
        updateSuggestionSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = selectedSearchIndex >= 0 ? currentSearchMatches[selectedSearchIndex] : currentSearchMatches[0];
        if (target) {
          openWorkspaceFileFromSearch(target.path);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        sidebarSearchInput.value = '';
        if (sidebarSearchClear) sidebarSearchClear.style.display = 'none';
        sidebarSearchSuggestions.style.display = 'none';
      }
    });

    sidebarSearchInput.addEventListener('blur', () => {
      setTimeout(() => {
        if (sidebarSearchSuggestions) sidebarSearchSuggestions.style.display = 'none';
      }, 200);
    });

    sidebarSearchInput.addEventListener('focus', () => {
      if (sidebarSearchInput.value.trim()) {
        performSidebarFileSearch();
      }
    });
  }

  if (sidebarSearchClear) {
    sidebarSearchClear.addEventListener('click', () => {
      if (sidebarSearchInput) {
        sidebarSearchInput.value = '';
        sidebarSearchInput.focus();
      }
      sidebarSearchClear.style.display = 'none';
      if (sidebarSearchSuggestions) {
        sidebarSearchSuggestions.style.display = 'none';
        sidebarSearchSuggestions.innerHTML = '';
      }
      currentSearchMatches = [];
      selectedSearchIndex = -1;
    });
  }

  // 12. Workspace Loader
  async function loadWorkspace(dirPath: string) {
    fsService.setWorkspace(dirPath);
    editorState.setWorkspace(dirPath);
    lspClient.setWorkspaceRoot(dirPath);
    const folderName = dirPath.split(/[/\\]/).filter(Boolean).pop() || dirPath;
    workspaceTitle.textContent = folderName.toUpperCase();
    await fileTree.loadWorkspace(dirPath);
    updateSidebarWorkspaceUi();
    updateAppTitle(editorState.getActiveTab());
    terminalPanel.setCwd(dirPath);
    terminalPanel.logOutput(`Opened workspace folder: ${dirPath}`);
    gitService.refresh();
    gitPanel.refresh();
    statusBar.showMessage(`Opened folder: ${folderName}`);

    // If native mode and an active tab was restored for this workspace, refresh its content from disk
    const activeTab = editorState.getActiveTab();
    if (activeTab && isNative() && activeTab.viewMode !== 'image' && activeTab.viewMode !== 'binary' && activeTab.viewMode !== 'git-graph') {
      try {
        const fresh = await fsService.readFile(activeTab.path);
        editorState.markSaved(activeTab.id, fresh);
        editorManager.loadDocument(fresh, activeTab.path);
      } catch (err) {
        console.warn('Could not refresh active tab from disk:', err);
      }
    }

    // Synchronize all open restored tabs with LSP so background tabs also compute diagnostics immediately
    for (const tab of editorState.getTabs()) {
      if (
        tab.path &&
        !tab.path.startsWith('Untitled-') &&
        tab.viewMode !== 'image' &&
        tab.viewMode !== 'binary' &&
        tab.viewMode !== 'git-graph' &&
        (!activeTab || tab.id !== activeTab.id)
      ) {
        const langInfo = detectLanguage(tab.path);
        if (langInfo.languageId && langInfo.languageId !== 'plaintext') {
          if (isNative()) {
            fsService.readFile(tab.path).then((content) => {
              lspClient.notifyDidOpen(tab.path, langInfo.languageId || 'plaintext', 1, content);
            }).catch(() => {
              if (tab.content) {
                lspClient.notifyDidOpen(tab.path, langInfo.languageId || 'plaintext', 1, tab.content);
              }
            });
          } else if (tab.content) {
            lspClient.notifyDidOpen(tab.path, langInfo.languageId || 'plaintext', 1, tab.content);
          }
        }
      }
    }

    // Update recent workspaces list
    try {
      if (dirPath && dirPath !== '.') {
        const recent = preferencesService.get('workbench.recentWorkspaces') || [];
        const filtered = recent.filter(p => p.toLowerCase() !== dirPath.toLowerCase());
        preferencesService.set('workbench.recentWorkspaces', [dirPath, ...filtered].slice(0, 10));
      }
    } catch (e) {
      console.warn('Failed to update recent workspaces:', e);
    }
  }

  // Auto-refresh Git status when file watcher detects external changes on disk
  fsService.onWorkspaceChanged(() => {
    gitService.refresh();
  });

  // Re-connect active document when a language server is installed
  window.addEventListener('gitero:lsp-server-installed', () => {
    const activeTab = editorState.getActiveTab();
    if (activeTab && activeTab.viewMode !== 'image' && activeTab.viewMode !== 'binary' && activeTab.viewMode !== 'git-graph') {
      editorManager.loadDocument(activeTab.content, activeTab.path);
    }
  });

  function openRecentWorkspacesPicker() {
    const recent = preferencesService.get('workbench.recentWorkspaces') || [];
    if (recent.length === 0) {
      statusBar.showMessage('No recent workspaces found');
      return;
    }
    const items: PaletteItem[] = recent.map(dir => ({
      id: dir,
      title: dir.split(/[/\\]/).filter(Boolean).pop() || dir,
      detail: dir,
      category: 'Recent Workspaces',
      action: async () => {
        await loadWorkspace(dir);
      }
    }));
    items.push({
      id: 'recent.clear',
      title: 'Clear Recently Opened...',
      detail: 'Clear all entries from recent workspaces list',
      category: 'Recent Workspaces',
      action: () => {
        preferencesService.set('workbench.recentWorkspaces', []);
        statusBar.showMessage('Recent workspaces cleared');
      }
    });
    commandPalette.open(items);
  }

  function getParentFolder(filePath: string): string {
    const sep = filePath.includes('/') ? '/' : '\\';
    const parts = filePath.split(sep).filter(Boolean);
    parts.pop();
    return parts.join(sep) || '.';
  }

  // Check if Gitero was opened with CLI arguments (e.g. `gcode .` or `gcode <folder>` or `gcode <file>`)
  const checkExternalArguments = async (): Promise<{ openedWorkspace: boolean; openedFile: boolean }> => {
    let openedWorkspace = false;
    let openedFile = false;

    try {
      const nlArgs = (window as any).NL_ARGS;
      if (Array.isArray(nlArgs)) {
        for (let i = 1; i < nlArgs.length; i++) {
          const rawArg = nlArgs[i];
          if (!rawArg || rawArg.startsWith('--') || rawArg.startsWith('-') || rawArg.startsWith('/')) {
            continue;
          }

          let arg = rawArg.trim();
          if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
            arg = arg.slice(1, -1).trim();
          }
          if (arg.length > 3 && (arg.endsWith('\\') || arg.endsWith('/'))) {
            arg = arg.slice(0, -1);
          }

          // 1. Check if argument is a directory (e.g. from `gcode .` or `gcode <folder>`)
          try {
            if (isNative()) {
              const stats = await window.Neutralino.filesystem.getStats(arg);
              if (stats?.entry?.type === 'DIRECTORY' || (stats as any)?.isDirectory || stats?.type === 'DIRECTORY') {
                await loadWorkspace(arg);
                openedWorkspace = true;
                continue;
              }
            }
          } catch (e) {
            // Not a directory or getStats failed, check if readDirectory succeeds
            try {
              if (isNative()) {
                const entries = await window.Neutralino.filesystem.readDirectory(arg);
                if (entries && entries.length >= 0) {
                  await loadWorkspace(arg);
                  openedWorkspace = true;
                  continue;
                }
              }
            } catch (errDir) {
              // Not a directory
            }
          }

          // 2. Check if argument is an image file
          if (isImageFile(arg)) {
            editorState.openBinaryFile(arg, 'image');
            openedFile = true;
            if (!openedWorkspace) {
              const parent = getParentFolder(arg);
              await loadWorkspace(parent);
              openedWorkspace = true;
            }
            continue;
          }

          // 3. Check if argument is a binary file
          if (isBinaryFile(arg)) {
            editorState.openBinaryFile(arg, 'binary');
            openedFile = true;
            if (!openedWorkspace) {
              const parent = getParentFolder(arg);
              await loadWorkspace(parent);
              openedWorkspace = true;
            }
            continue;
          }

          // 4. Code / text file
          try {
            const content = await fsService.readFile(arg);
            const isMd = /\.md$/i.test(arg) || /\.markdown$/i.test(arg);
            // Opened externally / double-click in Windows -> open in rendered mode if markdown!
            editorState.openFile(arg, content, { viewMode: isMd ? 'rendered' : 'raw' });
            openedFile = true;

            if (!openedWorkspace) {
              const parent = getParentFolder(arg);
              await loadWorkspace(parent);
              openedWorkspace = true;
            }
          } catch (e) {
            // Not a readable file path
          }
        }
      }
    } catch (err) {
      console.warn('Could not check external arguments:', err);
    }

    return { openedWorkspace, openedFile };
  };

  if ((window as any).Neutralino?.events) {
    (window as any).Neutralino.events.on('openedFile', async (evt: any) => {
      if (evt?.detail) {
        const path = evt.detail;
        if (isImageFile(path)) {
          editorState.openBinaryFile(path, 'image');
        } else if (isBinaryFile(path)) {
          editorState.openBinaryFile(path, 'binary');
        } else {
          try {
            const content = await fsService.readFile(path);
            const isMd = /\.md$/i.test(path) || /\.markdown$/i.test(path);
            editorState.openFile(path, content, { viewMode: isMd ? 'rendered' : 'raw' });
          } catch (e) {
            console.warn('Failed to open file via openedFile event:', e);
          }
        }
        // Collapse sidebar instantaneously so the editor takes full focus when opening from outside the app
        sidebarEl.classList.add('no-transition');
        sidebarEl.classList.add('collapsed');
        requestAnimationFrame(() => {
          setTimeout(() => {
            sidebarEl.classList.remove('no-transition');
          }, 100);
        });
      }
    });
  }

  // Check CLI arguments first before falling back to cached workspace
  const { openedWorkspace, openedFile } = await checkExternalArguments();

  if (!openedWorkspace) {
    const initialWorkspace = fsService.getWorkspace() || '.';
    await loadWorkspace(initialWorkspace);
  }

  // Collapse sidebar when launched with an external file so the editor gets full focus
  if (openedFile) {
    sidebarEl.classList.add('collapsed');
  } else if (!isExternalFileBoot && preferencesService.get('workbench.sidebarVisible')) {
    sidebarEl.classList.remove('collapsed');
  }

  // If no tabs are open and no external file was opened, open a friendly README welcome if in unopened/empty directory
  if (!openedFile && editorState.getTabs().length === 0 && isUnopenedOrAppInstallDir(fsService.getWorkspace())) {
    editorState.openFile(
      'README.md',
      `# Gitero IDE

A high-performance, VS Code-styled, Vim-customizable IDE.

### Key Shortcuts
* **Ctrl + P**: Quick Open File
* **Ctrl + Shift + P**: Command Palette
* **Ctrl + S** or **:w**: Save File
* **Ctrl + W** or **:q**: Close File
* **Ctrl + K Ctrl + W**: Close All Tabs
* **Ctrl + B**: Toggle Sidebar
* **Ctrl + \`**: Toggle Integrated Terminal
* **Ctrl + Shift + F**: Search in Files
* **Ctrl + Shift + G**: Source Control (Git)
* **Ctrl + ,**: Settings & Custom CSS
* **F12** or **Ctrl + Shift + I**: Developer Tools

### Vim Mode
Vim mode is built-in and optional!
* Press \`i\` for Insert Mode, \`Esc\` for Normal Mode, \`v\` for Visual Mode
* Type \`:w\` to save, \`:q\` to close tab
* Click the **TEXT MODE** / **NORMAL** pill in the bottom-left status bar to toggle anytime!

### Themes & Customization
Press **Ctrl + Shift + P** and select **Switch Color Theme** to choose from:
Tokyo Night, One Dark Pro, Dracula, Catppuccin Mocha, Monokai, and GitHub Dark.
`,
      { viewMode: 'rendered' }
    );
  }

  updateSidebarWorkspaceUi();

  // 13. Buttons & Toolbar Events
  const handleOpenFolder = async () => {
    const folder = await fsService.selectFolder();
    if (folder) {
      await loadWorkspace(folder);
    }
  };

  document.getElementById('btn-open-folder')?.addEventListener('click', handleOpenFolder);
  document.getElementById('btn-open-folder-header')?.addEventListener('click', handleOpenFolder);

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
        const allFiles = await fsService.getWorkspaceFiles(ws);
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

  function openSnippetPicker() {
    const items: PaletteItem[] = SNIPPETS.map(snip => ({
      id: `snip-${snip.trigger}`,
      title: `${snip.name}: ${snip.detail}`,
      detail: snip.languages?.join(', ') || 'Snippet',
      category: 'Snippets',
      action: () => {
        editorManager.insertSnippet(snip.template);
      }
    }));
    commandPalette.open(items);
  }

  function openCommandPalette() {
    const commands: PaletteItem[] = [
      {
        id: 'git.viewGraph',
        title: 'Git: View Complete Commit Graph (Complete Tree)',
        category: 'Git',
        action: () => openGitGraphTab()
      },
      {
        id: 'git.showOutput',
        title: 'Git: Show Git Output Console',
        category: 'Git',
        action: () => {
          terminalPanel.toggle(true);
          const outBtn = document.getElementById('tab-btn-output') as HTMLElement;
          outBtn?.click();
        }
      },
      {
        id: 'snippets.insert',
        title: 'Snippets: Insert Snippet / Boilerplate (!html5, rafce, etc.)...',
        category: 'Snippets',
        action: () => openSnippetPicker()
      },
      {
        id: 'edit.commentLine',
        title: 'Edit: Toggle Line Comment',
        detail: 'Ctrl+/',
        category: 'Edit',
        action: () => editorManager.toggleComment()
      },
      {
        id: 'edit.blockComment',
        title: 'Edit: Toggle Block Comment',
        detail: 'Ctrl+Shift+/',
        category: 'Edit',
        action: () => editorManager.toggleBlockComment()
      },
      {
        id: 'edit.copyLineDown',
        title: 'Edit: Copy Line Down (Duplicate)',
        detail: 'Shift+Alt+Down',
        category: 'Edit',
        action: () => editorManager.copyLineDown()
      },
      {
        id: 'edit.copyLineUp',
        title: 'Edit: Copy Line Up',
        detail: 'Shift+Alt+Up',
        category: 'Edit',
        action: () => editorManager.copyLineUp()
      },
      {
        id: 'edit.moveLineDown',
        title: 'Edit: Move Line Down',
        detail: 'Alt+Down',
        category: 'Edit',
        action: () => editorManager.moveLineDown()
      },
      {
        id: 'edit.moveLineUp',
        title: 'Edit: Move Line Up',
        detail: 'Alt+Up',
        category: 'Edit',
        action: () => editorManager.moveLineUp()
      },
      {
        id: 'edit.deleteLine',
        title: 'Edit: Delete Line',
        detail: 'Ctrl+Shift+K',
        category: 'Edit',
        action: () => editorManager.deleteLine()
      },
      {
        id: 'theme.switch',
        title: 'Preferences: Switch Color Theme',
        category: 'Theme',
        action: () => openThemePicker()
      },
      {
        id: 'vim.toggle',
        title: `Editing Mode: Toggle Vim Mode (${vimIntegration.isEnabled() ? 'Switch to Standard Text Mode' : 'Enable Vim Mode'})`,
        category: 'Vim',
        action: () => {
          const next = !vimIntegration.isEnabled();
          vimIntegration.setEnabled(next);
          editorManager.toggleVim(next);
          statusBar.updateVimMode(vimIntegration.getCurrentMode());
          statusBar.showMessage(`Editing Mode: ${next ? 'Vim Mode' : 'Standard Text Mode'}`);
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
        id: 'file.openRecent',
        title: 'File: Open Recent Workspace...',
        category: 'File',
        action: () => openRecentWorkspacesPicker()
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
        id: 'view.closeActiveEditor',
        title: 'View: Close Active Editor',
        detail: 'Ctrl+W',
        category: 'View',
        action: () => {
          const active = editorState.getActiveTab();
          if (active) editorState.closeTab(active.id);
        }
      },
      {
        id: 'view.closeAllEditors',
        title: 'View: Close All Editors / Tabs',
        detail: 'Ctrl+K Ctrl+W',
        category: 'View',
        action: () => editorState.closeAllTabs()
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
        id: 'preferences.registerMarkdownAssoc',
        title: 'Preferences: Register Gitero as Default Markdown Reader (.md)',
        category: 'Preferences',
        action: async () => {
          statusBar.showMessage('Registering Gitero as default Markdown reader...');
          const res = await fileAssociationService.registerMarkdownAsDefault();
          if (res.success) {
            statusBar.showMessage('Gitero registered as default Markdown reader with dedicated Markdown icon.');
          } else {
            statusBar.showMessage(`Failed to register Markdown association: ${res.error}`);
          }
        }
      },
      {
        id: 'preferences.registerAllFileAssoc',
        title: 'Preferences: Register All File Associations (with Document Icons)',
        category: 'Preferences',
        action: async () => {
          statusBar.showMessage('Registering all file associations with document icons...');
          const res = await fileAssociationService.registerAll();
          if (res.success) {
            statusBar.showMessage(`Registered document icons for ${res.registered} file extensions.`);
          } else {
            statusBar.showMessage(`Failed to register file associations: ${res.error}`);
          }
        }
      },
      {
        id: 'preferences.refreshWindowsIconCache',
        title: 'Preferences: Refresh Windows File Icon Cache',
        category: 'Preferences',
        action: async () => {
          statusBar.showMessage('Refreshing Windows Explorer icon cache...');
          const ok = await fileAssociationService.refreshWindowsIconCache();
          statusBar.showMessage(ok ? 'Windows Explorer icon cache refresh signal sent.' : 'Icon cache refresh not supported on this OS.');
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
        action: () => {
          sidebarEl.classList.toggle('collapsed');
          preferencesService.set('workbench.sidebarVisible', !sidebarEl.classList.contains('collapsed'));
        }
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
        id: 'view.toggleIndentGuides',
        title: 'View: Toggle Indentation Guides',
        category: 'View',
        action: () => {
          const isGuides = editorManager.toggleIndentGuides();
          statusBar.showMessage(`Indentation Guides: ${isGuides ? 'ENABLED' : 'DISABLED'}`);
        }
      },
      {
        id: 'view.toggleMinimap',
        title: 'View: Toggle Minimap (Code Preview)',
        category: 'View',
        action: () => {
          const isMinimap = editorManager.toggleMinimap();
          statusBar.showMessage(`Minimap: ${isMinimap ? 'ENABLED' : 'DISABLED'}`);
        }
      },
      {
        id: 'view.toggleOverviewRuler',
        title: 'View: Toggle Scrollbar Overview Ruler',
        category: 'View',
        action: () => {
          const isRuler = editorManager.toggleOverviewRuler();
          statusBar.showMessage(`Scrollbar Overview Ruler: ${isRuler ? 'ENABLED' : 'DISABLED'}`);
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
        detail: 'Alt+0',
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
        id: 'git.switchBranch',
        title: 'Git: Switch Branch...',
        detail: 'Ctrl+Shift+B',
        category: 'Git',
        action: () => openBranchPicker()
      },
      {
        id: 'git.sync',
        title: 'Git: Sync / Push Changes',
        detail: 'Ctrl+Shift+U',
        category: 'Git',
        action: () => syncGit()
      },
      {
        id: 'git.stageAll',
        title: 'Git: Stage All Changes',
        category: 'Git',
        action: () => gitService.stageAll()
      },
      {
        id: 'git.unstageAll',
        title: 'Git: Unstage All Changes',
        category: 'Git',
        action: () => gitService.unstageAll()
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
      },
      {
        id: 'workbench.action.toggleFullScreen',
        title: 'View: Toggle Full Screen',
        detail: 'F11',
        category: 'View',
        action: () => toggleFullScreen()
      },
      {
        id: 'developer.toggleDevTools',
        title: 'Developer: Toggle Developer Tools',
        detail: 'F12 or Ctrl+Shift+I',
        category: 'Developer',
        action: () => {
          statusBar.showMessage('Developer Tools: Press F12 or Ctrl+Shift+I (or right-click -> Inspect)');
        }
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
      if (e.key.toLowerCase() === 'w') {
        e.preventDefault();
        isCtrlK = false;
        editorState.closeAllTabs();
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

    // Git Sync
    if (matchAction('git.sync')) {
      e.preventDefault();
      syncGit();
      return;
    }

    // Git Switch Branch
    if (matchAction('git.switchBranch')) {
      e.preventDefault();
      openBranchPicker();
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

    // Close Active Editor
    if (matchAction('workbench.action.closeActiveEditor')) {
      e.preventDefault();
      const active = editorState.getActiveTab();
      if (active) {
        editorState.closeTab(active.id);
      }
      return;
    }

    // Close All Editors
    if (matchAction('workbench.action.closeAllEditors')) {
      e.preventDefault();
      editorState.closeAllTabs();
      return;
    }

    // Reopen Closed Editor
    if (matchAction('workbench.action.reopenClosedEditor')) {
      e.preventDefault();
      const reopened = editorState.reopenClosedTab();
      if (reopened) {
        statusBar.showMessage(`Reopened: ${reopened.name}`);
      }
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

    // Toggle Line Comment
    if (matchAction('editor.action.commentLine')) {
      e.preventDefault();
      editorManager.toggleComment();
      return;
    }

    // Toggle Block Comment
    if (matchAction('editor.action.blockComment')) {
      e.preventDefault();
      editorManager.toggleBlockComment();
      return;
    }

    // Duplicate Line Down
    if (matchAction('editor.action.copyLinesDownAction')) {
      e.preventDefault();
      editorManager.copyLineDown();
      return;
    }

    // Duplicate Line Up
    if (matchAction('editor.action.copyLinesUpAction')) {
      e.preventDefault();
      editorManager.copyLineUp();
      return;
    }

    // Move Line Down
    if (matchAction('editor.action.moveLinesDownAction')) {
      e.preventDefault();
      editorManager.moveLineDown();
      return;
    }

    // Move Line Up
    if (matchAction('editor.action.moveLinesUpAction')) {
      e.preventDefault();
      editorManager.moveLineUp();
      return;
    }

    // Delete Line
    if (matchAction('editor.action.deleteLines')) {
      e.preventDefault();
      editorManager.deleteLine();
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

    // Toggle Full Screen (F11)
    if (matchAction('workbench.action.toggleFullScreen') || e.key === 'F11') {
      e.preventDefault();
      toggleFullScreen();
      return;
    }

    // Cycle Cursor Style (Alt+0)
    if (matchAction('editor.action.cycleCursorStyle') || (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0'))) {
      e.preventDefault();
      const style = editorManager.cycleCursorStyle();
      statusBar.showMessage(`Cursor Style: ${style.toUpperCase()} (Saved as preference)`);
      return;
    }
  });

  // Re-enable smooth interactive transitions after initial boot is settled
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.documentElement.classList.remove('init-sidebar-collapsed');
      sidebarEl.classList.remove('no-transition');
    }, 150);
  });

  const duration = (performance.now() - startTime).toFixed(1);
  console.log(`[Gitero IDE] Started in ${duration}ms`);
  statusBar.showMessage(`Gitero IDE ready in ${duration}ms`);
}

// Start app
window.addEventListener('DOMContentLoaded', bootstrap);
window.addEventListener('beforeunload', () => {
  lspClient.stopAll();
});
