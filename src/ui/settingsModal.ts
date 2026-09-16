import { themeManager } from '../themes/themeManager';
import { ThemeDefinition } from '../themes/themes';
import { vimIntegration } from '../editor/vim';
import { updaterService } from '../services/updater';
import { preferencesService, CursorStyle } from '../services/preferences';

export interface KeybindingDefinition {
  id: string;
  name: string;
  category: string;
}

export const KEYBINDING_DEFINITIONS: KeybindingDefinition[] = [
  { id: 'workbench.action.quickOpen', name: 'Quick Open File', category: 'File' },
  { id: 'workbench.action.showCommands', name: 'Command Palette', category: 'View' },
  { id: 'workbench.action.files.save', name: 'Save File', category: 'File' },
  { id: 'workbench.action.files.saveAs', name: 'Save File As...', category: 'File' },
  { id: 'workbench.action.files.newUntitledFile', name: 'New Untitled File', category: 'File' },
  { id: 'workbench.action.files.openFile', name: 'Open File...', category: 'File' },
  { id: 'workbench.action.closeActiveEditor', name: 'Close Active Editor', category: 'View' },
  { id: 'workbench.action.toggleSidebarVisibility', name: 'Toggle Sidebar Visibility', category: 'View' },
  { id: 'workbench.action.terminal.toggleTerminal', name: 'Toggle Integrated Terminal', category: 'Terminal' },
  { id: 'workbench.action.findInFiles', name: 'Find in Files (Global Search)', category: 'Search' },
  { id: 'workbench.view.scm', name: 'Source Control (Git)', category: 'Git' },
  { id: 'git.sync', name: 'Git: Sync / Push Remote Changes', category: 'Git' },
  { id: 'git.switchBranch', name: 'Git: Switch Branch...', category: 'Git' },
  { id: 'editor.action.toggleWordWrap', name: 'Toggle Word Wrap', category: 'Editor' },
  { id: 'editor.action.commentLine', name: 'Toggle Line Comment', category: 'Editor' },
  { id: 'editor.action.blockComment', name: 'Toggle Block Comment', category: 'Editor' },
  { id: 'editor.action.copyLinesDownAction', name: 'Copy Line Down (Duplicate)', category: 'Editor' },
  { id: 'editor.action.copyLinesUpAction', name: 'Copy Line Up', category: 'Editor' },
  { id: 'editor.action.moveLinesDownAction', name: 'Move Line Down', category: 'Editor' },
  { id: 'editor.action.moveLinesUpAction', name: 'Move Line Up', category: 'Editor' },
  { id: 'editor.action.deleteLines', name: 'Delete Line', category: 'Editor' },
  { id: 'editor.action.indentLines', name: 'Indent Line', category: 'Editor' },
  { id: 'editor.action.outdentLines', name: 'Outdent Line', category: 'Editor' },
  { id: 'editor.action.selectLine', name: 'Select Current Line', category: 'Editor' },
  { id: 'markdown.showPreview', name: 'Toggle Markdown Preview / Raw Editor', category: 'Markdown' },
  { id: 'workbench.action.openSettings', name: 'Open Settings & Custom CSS', category: 'Preferences' },
  { id: 'workbench.action.openShortcuts', name: 'Keyboard Shortcuts Reference', category: 'Help' },
  { id: 'workbench.action.toggleDevTools', name: 'Toggle Developer Tools', category: 'Developer' }
];

export class SettingsModalComponent {
  private overlay!: HTMLElement;
  private isOpen: boolean = false;
  private onVimToggled?: (enabled: boolean) => void;

  constructor(options?: { onVimToggled?: (enabled: boolean) => void }) {
    this.onVimToggled = options?.onVimToggled;
    this.createDom();
  }

  private createDom() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-modal-overlay';
    this.overlay.style.display = 'none';

    this.overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <div class="settings-header-title-group">
            <h2>Gitero Settings & Preferences</h2>
            <span class="settings-header-badge">Preferences</span>
          </div>
          <button class="settings-close-btn" aria-label="Close">×</button>
        </div>

        <div class="settings-body-wrapper">
          <!-- Left: Stacked Tabs Sidebar Navigation -->
          <nav class="settings-tabs-sidebar" aria-label="Settings Categories">
            <button class="settings-tab-btn active" data-target="editor">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>Editor</span>
            </button>
            <button class="settings-tab-btn" data-target="files">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Files</span>
            </button>
            <button class="settings-tab-btn" data-target="appearance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              <span>Appearance</span>
            </button>
            <button class="settings-tab-btn" data-target="shortcuts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>
              <span>Shortcuts</span>
            </button>
            <button class="settings-tab-btn" data-target="updates">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span>Updates</span>
            </button>
            <button class="settings-tab-btn" data-target="css">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>
              <span>Custom CSS</span>
            </button>
          </nav>

          <!-- Right: Scrollable Tab Content Area -->
          <div class="settings-tab-content">
            <!-- 1. Editor Tab Pane -->
            <div class="settings-tab-pane active" id="tab-pane-editor" data-tab="editor">
              <div class="settings-section-header">
                <div class="settings-section-title">Editor Configuration</div>
                <div class="settings-section-subtitle">Customize typography, cursor styling, tab spacing, line wrapping, and editing modes.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Typography</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Font Family</span>
                    <span class="setting-desc">Monospace font stack with coding ligature support</span>
                  </div>
                  <input type="text" id="setting-font-family" class="setting-input" style="width: 250px;" value="Cascadia Code, Fira Code, JetBrains Mono, Consolas, monospace" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Font Size (px)</span>
                    <span class="setting-desc">Text size in the code editor viewport</span>
                  </div>
                  <input type="number" id="setting-font-size" class="setting-input-small" min="10" max="32" value="14" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Cursor & Display</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Cursor Style</span>
                    <span class="setting-desc">Caret presentation style in editor</span>
                  </div>
                  <select id="setting-cursor-style" class="setting-select">
                    <option value="line">Line (Bar) [Default]</option>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Cursor Blinking</span>
                    <span class="setting-desc">Animation curve for cursor blink</span>
                  </div>
                  <select id="setting-cursor-blinking" class="setting-select">
                    <option value="blink">Blink [Default]</option>
                    <option value="smooth">Smooth Fade</option>
                    <option value="solid">Solid (No Blink)</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Tab Size (Spaces)</span>
                    <span class="setting-desc">Number of spaces rendered per indentation level</span>
                  </div>
                  <input type="number" id="setting-tab-size" class="setting-input-small" min="1" max="8" value="2" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Word Wrap</span>
                    <span class="setting-desc">Wrap long lines to fit viewport width</span>
                  </div>
                  <input type="checkbox" id="setting-word-wrap" class="setting-checkbox" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Modal Editing</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Vim Keybindings</span>
                    <span class="setting-desc">Standard vi/vim modal editing commands (:w, :q, hjkl, etc.)</span>
                  </div>
                  <input type="checkbox" id="setting-vim-toggle" class="setting-checkbox" />
                </div>
              </div>
            </div>

            <!-- 2. Files & Auto-Save Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-files" data-tab="files">
              <div class="settings-section-header">
                <div class="settings-section-title">Files & Auto-Save</div>
                <div class="settings-section-subtitle">Manage automated file saving and workspace file behaviors.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Auto-Save Behavior</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Enable Auto Save</span>
                    <span class="setting-desc">Automatically persist modified files after a brief pause</span>
                  </div>
                  <input type="checkbox" id="setting-auto-save-toggle" class="setting-checkbox" />
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Auto Save Delay (ms)</span>
                    <span class="setting-desc">Idle delay in milliseconds before automatically saving (e.g. 1000)</span>
                  </div>
                  <input type="number" id="setting-auto-save-delay" class="setting-input-small" min="100" max="10000" step="100" value="1000" />
                </div>
              </div>
            </div>

            <!-- 3. Appearance Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-appearance" data-tab="appearance">
              <div class="settings-section-header">
                <div class="settings-section-title">Appearance & Theme Studio</div>
                <div class="settings-section-subtitle">Customize workspace chrome, editor surfaces, and syntax highlighting tokens, or create and export your own custom themes.</div>
              </div>

              <!-- Theme Toolbar -->
              <div class="setting-card theme-studio-card">
                <div class="theme-studio-header">
                  <div class="theme-select-container">
                    <label for="setting-theme-select" class="theme-field-label">Theme Preset:</label>
                    <select id="setting-theme-select" class="setting-select"></select>
                  </div>
                  <div class="theme-studio-actions">
                    <button class="btn btn-secondary btn-sm" id="btn-theme-new" title="Create new custom theme">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span>New Theme</span>
                    </button>
                    <button class="btn btn-primary btn-sm" id="btn-theme-save" title="Save customizations to theme">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      <span>Save Theme</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-theme-export" title="Export current theme as JSON">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      <span>Export JSON</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-theme-import" title="Import theme from JSON">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span>Import JSON</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-theme-delete" title="Delete custom theme" style="display: none; color: #f85149;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Live Interactive Code Preview -->
              <div class="setting-card">
                <div class="setting-card-title">Live Code & Syntax Preview</div>
                <div id="theme-live-preview-box" class="theme-live-preview-box"></div>
              </div>

              <!-- Workspace Colors -->
              <div class="setting-card">
                <div class="setting-card-title">Workspace Chrome Colors</div>
                <div class="color-picker-grid" id="theme-colors-workspace"></div>
              </div>

              <!-- Editor Surface Colors -->
              <div class="setting-card">
                <div class="setting-card-title">Editor Surface & Cursor Colors</div>
                <div class="color-picker-grid" id="theme-colors-editor"></div>
              </div>

              <!-- Syntax Highlighting Colors -->
              <div class="setting-card">
                <div class="setting-card-title">Syntax Token Highlighting Colors</div>
                <div class="color-picker-grid" id="theme-colors-syntax"></div>
              </div>
            </div>

            <!-- 4. Keyboard Shortcuts Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-shortcuts" data-tab="shortcuts">
              <div class="settings-section-header">
                <div class="settings-section-title">Keyboard Shortcuts</div>
                <div class="settings-section-subtitle">Customize keybindings for commands. Click "Change" or double-click to assign keys.</div>
              </div>

              <div class="setting-card keybindings-section">
                <div class="keybindings-header">
                  <div class="keybindings-search-box" style="flex: 1; margin: 0;">
                    <input type="text" id="setting-keybinding-search" class="setting-input" style="width: 100%;" placeholder="Search shortcuts (e.g. Save, Ctrl+S, Markdown)..." />
                  </div>
                  <button class="btn btn-secondary btn-sm" id="btn-reset-keybindings" title="Reset all keybindings to defaults">Reset to Defaults</button>
                </div>

                <div class="keybindings-table-wrapper">
                  <table class="keybindings-table">
                    <thead>
                      <tr>
                        <th>Command</th>
                        <th>Keybinding</th>
                        <th style="width: 110px; text-align: right;">Action</th>
                      </tr>
                    </thead>
                    <tbody id="keybindings-table-body"></tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- 5. Software Updates Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-updates" data-tab="updates">
              <div class="settings-section-header">
                <div class="settings-section-title">Software Updates</div>
                <div class="settings-section-subtitle">Switch channels and update Gitero IDE directly from any GitHub branch.</div>
              </div>

              <div class="update-box">
                <div class="update-meta-grid">
                  <div class="update-meta-card">
                    <span class="meta-label">Installed Version</span>
                    <span class="meta-val" id="update-cur-ver">0.0.4-alpha</span>
                  </div>
                  <div class="update-meta-card">
                    <span class="meta-label">Current Branch</span>
                    <span class="meta-val" id="update-cur-branch">main</span>
                  </div>
                  <div class="update-meta-card">
                    <span class="meta-label">Current SHA</span>
                    <span class="meta-val" id="update-cur-sha">HEAD</span>
                  </div>
                </div>

                <div class="update-controls-row">
                  <div class="update-channel-group">
                    <label for="update-branch-select">Target Branch:</label>
                    <select id="update-branch-select" class="setting-select">
                      <option value="main">main</option>
                    </select>
                  </div>
                  <div class="update-buttons">
                    <button class="btn btn-secondary" id="btn-check-update">Check for Updates</button>
                    <button class="btn btn-primary" id="btn-apply-update" disabled>Update Now</button>
                  </div>
                </div>

                <div class="update-status" id="update-status-msg">Click "Check for Updates" to query the repository.</div>

                <div class="update-history-section">
                  <div class="update-history-header">
                    <div class="history-title-group">
                      <h4>Update & Rollback History</h4>
                      <span class="history-badge" id="history-count-badge">0</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-toggle-history">Show History</button>
                  </div>
                  <div class="update-history-list" id="update-history-list" style="display: none;"></div>
                </div>
              </div>
            </div>

            <!-- 6. Custom CSS Tab Pane -->
            <div class="settings-tab-pane" id="tab-pane-css" data-tab="css">
              <div class="settings-section-header">
                <div class="settings-section-title">Custom CSS Override</div>
                <div class="settings-section-subtitle">Inject arbitrary CSS rules to style any editor component, cursor, scrollbar, or status bar.</div>
              </div>

              <div class="setting-card">
                <textarea id="setting-custom-css" class="setting-textarea" placeholder="/* Enter custom CSS rules here */&#10;/* Example: */&#10;/* .cm-cursor { border-left-color: #58a6ff !important; box-shadow: 0 0 8px #58a6ff; } */"></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-footer">
          <div class="settings-footer-info">
            <span>Changes apply immediately upon saving.</span>
          </div>
          <div class="settings-footer-actions">
            <button class="btn btn-secondary" id="settings-cancel">Close</button>
            <button class="btn btn-primary" id="settings-save">Save & Apply</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    const closeBtn = this.overlay.querySelector('.settings-close-btn') as HTMLElement;
    const cancelBtn = this.overlay.querySelector('#settings-cancel') as HTMLElement;
    const saveBtn = this.overlay.querySelector('#settings-save') as HTMLElement;

    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    saveBtn.addEventListener('click', () => this.save());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    // Wire up sidebar tab switches
    const tabBtns = this.overlay.querySelectorAll('.settings-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target) this.switchTab(target);
      });
    });

    this.setupUpdateListeners();
    this.setupKeybindingsListeners();
    this.setupThemeStudioListeners();
  }

  private setupUpdateListeners() {
    const branchSelect = this.overlay.querySelector('#update-branch-select') as HTMLSelectElement;
    const refreshBtn = this.overlay.querySelector('#btn-refresh-branches') as HTMLButtonElement;
    const checkBtn = this.overlay.querySelector('#btn-check-update') as HTMLButtonElement;
    const applyBtn = this.overlay.querySelector('#btn-apply-update') as HTMLButtonElement;
    const statusMsg = this.overlay.querySelector('#update-status-msg') as HTMLElement;

    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      await this.loadBranches();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
    });

    checkBtn.addEventListener('click', async () => {
      const branch = branchSelect.value;
      checkBtn.disabled = true;
      statusMsg.innerHTML = `<span class="loading-spinner"></span> Checking GitHub for branch <strong>${branch}</strong>...`;

      try {
        const result = await updaterService.checkForUpdates(branch);
        if (result.isUpdateAvailable) {
          statusMsg.innerHTML = `
            <div class="update-avail-box">
              <span class="status-badge badge-avail">Update Available</span>
              <div class="commit-details">
                <div><strong>Commit:</strong> <code>${result.latestSha}</code></div>
                <div><strong>Message:</strong> ${result.latestCommit?.message}</div>
                <div><strong>Author:</strong> ${result.latestCommit?.author} (${new Date(result.latestCommit?.date || '').toLocaleDateString()})</div>
              </div>
            </div>
          `;
          applyBtn.disabled = false;
          applyBtn.textContent = `Update from ${branch}`;
        } else {
          statusMsg.innerHTML = `
            <div class="update-uptodate-box">
              <span class="status-badge badge-latest">Up to Date</span>
              <span>You are already running the latest commit (<code>${result.currentSha}</code>) on branch <strong>${branch}</strong>.</span>
            </div>
          `;
          applyBtn.disabled = false;
          applyBtn.textContent = `Force Re-sync ${branch}`;
        }
      } catch (err: any) {
        statusMsg.innerHTML = `<span class="error-text">${err.message || 'Could not connect to GitHub'}</span>`;
        applyBtn.disabled = true;
      } finally {
        checkBtn.disabled = false;
      }
    });

    applyBtn.addEventListener('click', async () => {
      const branch = branchSelect.value;
      applyBtn.disabled = true;
      checkBtn.disabled = true;

      try {
        await updaterService.updateFromBranch(branch, (step) => {
          statusMsg.innerHTML = `<span class="loading-spinner"></span> ${step}`;
        });

        statusMsg.innerHTML = `
          <div class="update-success-box">
            <span class="status-badge badge-latest">Update Applied Successfully</span>
            <p>Gitero IDE updated to branch <strong>${branch}</strong>.</p>
            <button class="btn btn-primary btn-sm" id="btn-restart-now" style="margin-top: 8px;">Restart Gitero IDE</button>
          </div>
        `;

        this.overlay.querySelector('#btn-restart-now')?.addEventListener('click', () => {
          updaterService.restartApp();
        });

        (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
        (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();
        this.renderUpdateHistory();
      } catch (err: any) {
        statusMsg.innerHTML = `<span class="error-text">Update failed: ${err.message}</span>`;
        applyBtn.disabled = false;
        checkBtn.disabled = false;
      }
    });

    const toggleHistoryBtn = this.overlay.querySelector('#btn-toggle-history') as HTMLButtonElement;
    const historyList = this.overlay.querySelector('#update-history-list') as HTMLElement;

    toggleHistoryBtn.addEventListener('click', () => {
      const isHidden = historyList.style.display === 'none';
      if (isHidden) {
        historyList.style.display = 'flex';
        toggleHistoryBtn.textContent = 'Hide History';
        this.renderUpdateHistory();
      } else {
        historyList.style.display = 'none';
        toggleHistoryBtn.textContent = 'Show History';
      }
    });
  }

  private async loadBranches() {
    const branchSelect = this.overlay.querySelector('#update-branch-select') as HTMLSelectElement;
    const currentBranch = updaterService.getCurrentBranch();

    try {
      const branches = await updaterService.fetchBranches();
      branchSelect.innerHTML = '';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        if (b === currentBranch) opt.selected = true;
        branchSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn('Could not load branches', e);
    }
  }

  private renderUpdateHistory() {
    const historyList = this.overlay.querySelector('#update-history-list') as HTMLElement;
    const countBadge = this.overlay.querySelector('#history-count-badge') as HTMLElement;
    const statusMsg = this.overlay.querySelector('#update-status-msg') as HTMLElement;
    const applyBtn = this.overlay.querySelector('#btn-apply-update') as HTMLButtonElement;
    const checkBtn = this.overlay.querySelector('#btn-check-update') as HTMLButtonElement;

    if (!historyList) return;

    const history = updaterService.getHistory();
    if (countBadge) countBadge.textContent = String(history.length);
    const currentSha = updaterService.getCurrentSha().toLowerCase();

    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty-msg">No update history recorded yet.</div>';
      return;
    }

    historyList.innerHTML = history.map(entry => {
      const isCurrent = entry.toSha.toLowerCase() === currentSha;
      const isRollback = entry.type === 'rollback';
      return `
        <div class="history-card ${isCurrent ? 'is-current' : ''}">
          <div class="history-card-header">
            <div class="history-badges">
              <span class="history-type-badge ${isRollback ? 'badge-rollback' : 'badge-update'}">${entry.type}</span>
              <span class="history-branch-badge">${entry.branch}</span>
              <span class="history-sha-badge"><code>${entry.toSha}</code></span>
            </div>
            <span class="history-timestamp" title="${entry.timestamp}">${entry.formattedTime}</span>
          </div>
          <div class="history-message">${entry.commitMessage}</div>
          <div class="history-card-footer">
            <span class="history-author">Author: ${entry.author}</span>
            ${isCurrent 
              ? `<span class="badge-active-state"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Current State</span>`
              : `<button class="btn btn-secondary btn-sm btn-rollback-state" data-entry-id="${entry.id}">Rollback to this state</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    // Attach rollback handlers
    historyList.querySelectorAll('.btn-rollback-state').forEach(btn => {
      btn.addEventListener('click', async () => {
        const entryId = btn.getAttribute('data-entry-id');
        const targetEntry = history.find(h => h.id === entryId);
        if (!targetEntry) return;

        applyBtn.disabled = true;
        checkBtn.disabled = true;
        statusMsg.innerHTML = `<span class="loading-spinner"></span> Initializing rollback to commit <code>${targetEntry.toSha}</code>...`;

        try {
          await updaterService.rollbackTo(targetEntry, (step) => {
            statusMsg.innerHTML = `<span class="loading-spinner"></span> ${step}`;
          });

          (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
          (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();

          statusMsg.innerHTML = `
            <div class="update-success-box">
              <span class="status-badge badge-latest">Rollback Applied</span>
              <p>Gitero IDE restored to commit <strong>${targetEntry.toSha}</strong> (${targetEntry.branch}).</p>
              <button class="btn btn-primary btn-sm" id="btn-restart-rollback" style="margin-top: 8px;">Restart Gitero IDE</button>
            </div>
          `;

          this.overlay.querySelector('#btn-restart-rollback')?.addEventListener('click', () => {
            updaterService.restartApp();
          });

          this.renderUpdateHistory();
        } catch (err: any) {
          statusMsg.innerHTML = `<span class="error-text">Rollback failed: ${err.message}</span>`;
        } finally {
          applyBtn.disabled = false;
          checkBtn.disabled = false;
        }
      });
    });
  }

  private editingActionId: string | null = null;

  private setupKeybindingsListeners() {
    const searchInput = this.overlay.querySelector('#setting-keybinding-search') as HTMLInputElement;
    const resetBtn = this.overlay.querySelector('#btn-reset-keybindings') as HTMLButtonElement;

    searchInput.addEventListener('input', () => {
      this.renderKeybindingsTable(searchInput.value.trim());
    });

    resetBtn.addEventListener('click', () => {
      const confirmReset = confirm('Reset all keyboard shortcuts to their default combinations?');
      if (confirmReset) {
        preferencesService.resetKeybindings();
        this.renderKeybindingsTable(searchInput.value.trim());
      }
    });
  }

  private renderKeybindingsTable(filterQuery: string = '') {
    const tbody = this.overlay.querySelector('#keybindings-table-body') as HTMLElement;
    if (!tbody) return;

    tbody.innerHTML = '';
    const q = filterQuery.toLowerCase();

    const filtered = KEYBINDING_DEFINITIONS.filter(def => {
      const shortcut = preferencesService.getKeybinding(def.id);
      return (
        !q ||
        def.name.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q) ||
        shortcut.toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="keybindings-empty">No matching keyboard shortcuts found</td></tr>`;
      return;
    }

    for (const def of filtered) {
      const tr = document.createElement('tr');
      tr.className = 'keybinding-row';

      const currentShortcut = preferencesService.getKeybinding(def.id);
      const isEditing = this.editingActionId === def.id;

      if (isEditing) {
        tr.classList.add('is-editing');
        tr.innerHTML = `
          <td class="keybinding-col-cmd">
            <div class="keybinding-cmd-name">${def.name}</div>
            <div class="keybinding-cmd-id"><code>${def.id}</code></div>
          </td>
          <td class="keybinding-col-keys">
            <input type="text" class="keybinding-recorder-input" value="${currentShortcut}" placeholder="Press keys..." />
          </td>
          <td class="keybinding-col-action">
            <div class="keybinding-edit-btns">
              <button class="btn btn-primary btn-sm btn-save-kb" title="Save keybinding">Save</button>
              <button class="btn btn-secondary btn-sm btn-cancel-kb" title="Cancel">Cancel</button>
            </div>
          </td>
        `;

        const recorderInput = tr.querySelector('.keybinding-recorder-input') as HTMLInputElement;
        const saveBtn = tr.querySelector('.btn-save-kb') as HTMLButtonElement;
        const cancelBtn = tr.querySelector('.btn-cancel-kb') as HTMLButtonElement;

        setTimeout(() => recorderInput.focus(), 30);

        recorderInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.editingActionId = null;
            this.renderKeybindingsTable(filterQuery);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            preferencesService.setKeybinding(def.id, recorderInput.value.trim());
            this.editingActionId = null;
            this.renderKeybindingsTable(filterQuery);
            return;
          }

          if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

          e.preventDefault();
          e.stopPropagation();

          const parts: string[] = [];
          if (e.ctrlKey) parts.push('Ctrl');
          if (e.altKey) parts.push('Alt');
          if (e.shiftKey) parts.push('Shift');
          if (e.metaKey) parts.push('Meta');

          let k = e.key;
          if (k === ' ') k = 'Space';
          else if (k.length === 1) k = k.toUpperCase();

          parts.push(k);
          recorderInput.value = parts.join('+');
        });

        saveBtn.addEventListener('click', () => {
          preferencesService.setKeybinding(def.id, recorderInput.value.trim());
          this.editingActionId = null;
          this.renderKeybindingsTable(filterQuery);
        });

        cancelBtn.addEventListener('click', () => {
          this.editingActionId = null;
          this.renderKeybindingsTable(filterQuery);
        });
      } else {
        const kbdHtml = currentShortcut
          ? `<kbd class="keybinding-kbd">${currentShortcut}</kbd>`
          : `<span class="keybinding-none">Unassigned</span>`;

        tr.innerHTML = `
          <td class="keybinding-col-cmd">
            <div class="keybinding-cmd-name">${def.name} <span class="keybinding-cat-badge">${def.category}</span></div>
            <div class="keybinding-cmd-id"><code>${def.id}</code></div>
          </td>
          <td class="keybinding-col-keys">${kbdHtml}</td>
          <td class="keybinding-col-action">
            <button class="btn btn-secondary btn-sm btn-change-kb" data-id="${def.id}">Change</button>
          </td>
        `;

        const changeBtn = tr.querySelector('.btn-change-kb') as HTMLButtonElement;
        changeBtn.addEventListener('click', () => {
          this.editingActionId = def.id;
          this.renderKeybindingsTable(filterQuery);
        });

        tr.addEventListener('dblclick', () => {
          this.editingActionId = def.id;
          this.renderKeybindingsTable(filterQuery);
        });
      }

      tbody.appendChild(tr);
    }
  }

  switchTab(tabId: string) {
    const tabBtns = this.overlay.querySelectorAll('.settings-tab-btn');
    const tabPanes = this.overlay.querySelectorAll('.settings-tab-pane');

    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-target') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.getAttribute('data-tab') === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  private workingTheme: ThemeDefinition | null = null;

  private setupThemeStudioListeners() {
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    const newBtn = this.overlay.querySelector('#btn-theme-new') as HTMLButtonElement;
    const saveBtn = this.overlay.querySelector('#btn-theme-save') as HTMLButtonElement;
    const exportBtn = this.overlay.querySelector('#btn-theme-export') as HTMLButtonElement;
    const importBtn = this.overlay.querySelector('#btn-theme-import') as HTMLButtonElement;
    const deleteBtn = this.overlay.querySelector('#btn-theme-delete') as HTMLButtonElement;

    themeSelect?.addEventListener('change', () => {
      this.loadThemeIntoStudio(themeSelect.value);
    });

    newBtn?.addEventListener('click', () => {
      const name = prompt('Enter a name for the new custom theme:', (this.workingTheme?.name || 'Custom') + ' Copy');
      if (!name || !name.trim()) return;
      const baseColors = this.workingTheme?.colors || themeManager.getCurrentTheme().colors;
      const id = 'custom-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
      const newTheme: ThemeDefinition = {
        id,
        name: name.trim(),
        isDark: true,
        colors: { ...baseColors }
      };
      themeManager.saveCustomTheme(newTheme);
      this.refreshThemeDropdown(newTheme.id);
      this.loadThemeIntoStudio(newTheme.id);
    });

    saveBtn?.addEventListener('click', () => {
      if (!this.workingTheme) return;
      if (themeManager.isCustomTheme(this.workingTheme.id)) {
        themeManager.saveCustomTheme(this.workingTheme);
        alert(`Saved theme "${this.workingTheme.name}".`);
      } else {
        const name = prompt('Preset themes are protected. Save as a new custom theme name:', this.workingTheme.name + ' Custom');
        if (!name || !name.trim()) return;
        const id = 'custom-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
        const newTheme: ThemeDefinition = {
          ...this.workingTheme,
          id,
          name: name.trim()
        };
        themeManager.saveCustomTheme(newTheme);
        this.refreshThemeDropdown(newTheme.id);
        this.loadThemeIntoStudio(newTheme.id);
      }
    });

    deleteBtn?.addEventListener('click', () => {
      if (!this.workingTheme || !themeManager.isCustomTheme(this.workingTheme.id)) return;
      if (confirm(`Delete custom theme "${this.workingTheme.name}"?`)) {
        themeManager.deleteCustomTheme(this.workingTheme.id);
        const curTheme = themeManager.getCurrentTheme();
        this.refreshThemeDropdown(curTheme.id);
        this.loadThemeIntoStudio(curTheme.id);
      }
    });

    exportBtn?.addEventListener('click', () => {
      if (!this.workingTheme) return;
      const json = JSON.stringify(this.workingTheme, null, 2);
      navigator.clipboard?.writeText(json).catch(() => {});
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.workingTheme.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    importBtn?.addEventListener('click', () => {
      const input = prompt('Paste theme JSON content here:');
      if (!input || !input.trim()) return;
      try {
        const imported = themeManager.importThemeJson(input.trim());
        this.refreshThemeDropdown(imported.id);
        this.loadThemeIntoStudio(imported.id);
      } catch (err: any) {
        alert('Failed to import theme: ' + err.message);
      }
    });
  }

  private refreshThemeDropdown(selectedId?: string) {
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    if (!themeSelect) return;
    themeSelect.innerHTML = '';

    const currentId = selectedId || themeManager.getCurrentTheme().id;
    const allThemes = themeManager.getAllThemes();

    const presets = allThemes.filter(t => !themeManager.isCustomTheme(t.id));
    const customs = allThemes.filter(t => themeManager.isCustomTheme(t.id));

    const optGroupPresets = document.createElement('optgroup');
    optGroupPresets.label = 'Built-in Presets';
    presets.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === currentId) opt.selected = true;
      optGroupPresets.appendChild(opt);
    });
    themeSelect.appendChild(optGroupPresets);

    if (customs.length > 0) {
      const optGroupCustoms = document.createElement('optgroup');
      optGroupCustoms.label = 'Custom Themes';
      customs.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (Custom)`;
        if (t.id === currentId) opt.selected = true;
        optGroupCustoms.appendChild(opt);
      });
      themeSelect.appendChild(optGroupCustoms);
    }
  }

  private loadThemeIntoStudio(themeId: string) {
    const theme = themeManager.getTheme(themeId);
    this.workingTheme = JSON.parse(JSON.stringify(theme));
    const deleteBtn = this.overlay.querySelector('#btn-theme-delete') as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.style.display = themeManager.isCustomTheme(theme.id) ? 'inline-flex' : 'none';
    }

    this.renderThemeLivePreview();
    this.renderColorPickers();
    themeManager.applyTheme(this.workingTheme!, false);
  }

  private renderThemeLivePreview() {
    const box = this.overlay.querySelector('#theme-live-preview-box') as HTMLElement;
    if (!box || !this.workingTheme) return;
    const c = this.workingTheme.colors;

    box.style.background = c.editorBg;
    box.style.borderColor = c.borderColor;

    box.innerHTML = `
      <div class="preview-chrome" style="background: ${c.bgSecondary}; border-bottom: 1px solid ${c.borderColor}; color: ${c.fgPrimary}; display: flex; align-items: center; justify-content: space-between; padding: 6px 12px;">
        <div class="preview-chrome-left" style="display: flex; align-items: center; gap: 8px;">
          <span class="preview-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #f85149; display: inline-block;"></span>
          <span class="preview-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #e3b341; display: inline-block;"></span>
          <span class="preview-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #2ea043; display: inline-block;"></span>
          <span class="preview-title" style="color: ${c.fgMuted}; font-size: 12px; margin-left: 6px; font-weight: 500;">${this.workingTheme.name}</span>
        </div>
        <div class="preview-chrome-badge" style="background: ${c.bgActive}; color: ${c.accent}; font-size: 11px; padding: 2px 8px; border-radius: 4px;">
          ${themeManager.isCustomTheme(this.workingTheme.id) ? 'Custom Theme' : 'Preset Theme'}
        </div>
      </div>
      <div class="preview-content-row" style="display: flex; min-height: 140px;">
        <div class="preview-sidebar" style="background: ${c.bgSidebar}; border-right: 1px solid ${c.borderColor}; color: ${c.fgMuted}; width: 140px; padding: 8px; font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div class="preview-tree-item" style="color: ${c.accent}; font-weight: 600;"><span style="margin-right: 4px;">▸</span> src</div>
          <div class="preview-tree-item active" style="background: ${c.bgActive}; color: ${c.fgPrimary}; padding: 2px 6px; border-radius: 3px;"><span style="margin-right: 4px;">•</span> main.ts</div>
          <div class="preview-tree-item" style="color: ${c.fgMuted}; padding: 2px 6px;"><span style="margin-right: 4px;">•</span> app.css</div>
        </div>
        <div class="preview-editor-canvas" style="flex: 1; background: ${c.editorBg}; color: ${c.editorFg}; font-family: monospace; font-size: 12.5px; padding: 8px 12px; line-height: 1.6;">
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">1</span> <span style="color: ${c.synComment}; font-style: italic;">// Gitero IDE — Live Syntax Preview</span></div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">2</span> <span style="color: ${c.synKeyword};">import</span> { <span style="color: ${c.synFunction};">createApp</span> } <span style="color: ${c.synKeyword};">from</span> <span style="color: ${c.synString};">'gitero'</span>;</div>
          <div class="preview-code-line active" style="background: ${c.editorActiveLine};"><span class="p-num" style="color: ${c.fgPrimary}; font-weight: bold; display: inline-block; width: 22px;">3</span> <span style="color: ${c.synKeyword};">export async function</span> <span style="color: ${c.synFunction};">buildApp</span>(<span style="color: ${c.synVariable};">config</span>: <span style="color: ${c.synType};">AppConfig</span>): <span style="color: ${c.synType};">Promise</span>&lt;<span style="color: ${c.synType};">boolean</span>&gt; {<span class="p-cursor" style="border-left: 2px solid ${c.editorCursor}; margin-left: 2px;"></span></div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">4</span>   <span style="color: ${c.synKeyword};">const</span> <span style="color: ${c.synVariable};">totalCount</span>: <span style="color: ${c.synType};">number</span> = <span style="color: ${c.synNumber};">42</span>;</div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">5</span>   <span style="color: ${c.synKeyword};">return</span> <span style="color: ${c.synVariable};">config</span>.<span style="color: ${c.synVariable};">enabled</span> <span style="color: ${c.synOperator};">===</span> <span style="color: ${c.synNumber};">true</span>;</div>
          <div class="preview-code-line"><span class="p-num" style="color: ${c.editorLineNumber}; display: inline-block; width: 22px;">6</span> }</div>
        </div>
      </div>
      <div class="preview-statusbar" style="background: ${c.statusBarBg}; color: ${c.statusBarFg}; border-top: 1px solid ${c.borderColor}; font-size: 11px; padding: 4px 12px; display: flex; justify-content: space-between;">
        <span>git: (main) • Synced</span>
        <span>TypeScript • UTF-8 • Tab Size: 2</span>
      </div>
    `;
  }

  private renderColorPickers() {
    if (!this.workingTheme) return;
    const colors = this.workingTheme.colors;

    const workspaceKeys: { key: keyof typeof colors; label: string }[] = [
      { key: 'bgPrimary', label: 'Primary Background' },
      { key: 'bgSidebar', label: 'Sidebar Background' },
      { key: 'bgSecondary', label: 'Top Bar / Chrome' },
      { key: 'bgHover', label: 'Hover Highlight' },
      { key: 'bgActive', label: 'Active Tab / Element' },
      { key: 'borderColor', label: 'Border & Dividers' },
      { key: 'accent', label: 'Accent & Links' },
      { key: 'statusBarBg', label: 'Status Bar Background' },
      { key: 'statusBarFg', label: 'Status Bar Text' }
    ];

    const editorKeys: { key: keyof typeof colors; label: string }[] = [
      { key: 'editorBg', label: 'Editor Canvas Background' },
      { key: 'editorFg', label: 'Editor Text' },
      { key: 'editorCursor', label: 'Cursor / Caret' },
      { key: 'editorSelection', label: 'Selection Highlight' },
      { key: 'editorActiveLine', label: 'Active Line Highlight' },
      { key: 'editorLineNumber', label: 'Line Numbers Gutter' }
    ];

    const syntaxKeys: { key: keyof typeof colors; label: string }[] = [
      { key: 'synKeyword', label: 'Keywords (import, function, return)' },
      { key: 'synString', label: 'Strings ("...", \'...\')' },
      { key: 'synFunction', label: 'Functions (createApp, buildApp)' },
      { key: 'synVariable', label: 'Variables (config, totalCount)' },
      { key: 'synComment', label: 'Comments (//, /* */)' },
      { key: 'synType', label: 'Types & Classes (Promise, number)' },
      { key: 'synNumber', label: 'Numbers & Booleans (42, true)' },
      { key: 'synOperator', label: 'Operators (===, =, +, &)' }
    ];

    const populateGrid = (containerId: string, keys: { key: keyof typeof colors; label: string }[]) => {
      const container = this.overlay.querySelector(containerId) as HTMLElement;
      if (!container) return;
      container.innerHTML = '';

      keys.forEach(({ key, label }) => {
        const val = (colors as any)[key] || '#ffffff';
        const card = document.createElement('div');
        card.className = 'color-item-card';
        card.innerHTML = `
          <div class="color-item-info">
            <span class="color-item-label">${label}</span>
            <code class="color-item-key">${key}</code>
          </div>
          <div class="color-item-inputs">
            <input type="color" class="color-picker-input" data-key="${key}" value="${val.length === 7 ? val : '#1a1b26'}" />
            <input type="text" class="color-text-input" data-key="${key}" value="${val}" spellcheck="false" />
          </div>
        `;

        const colorInput = card.querySelector('.color-picker-input') as HTMLInputElement;
        const textInput = card.querySelector('.color-text-input') as HTMLInputElement;

        const updateColor = (newVal: string) => {
          (this.workingTheme!.colors as any)[key] = newVal;
          if (newVal.length === 7) {
            colorInput.value = newVal;
          }
          textInput.value = newVal;
          this.renderThemeLivePreview();
          themeManager.applyTheme(this.workingTheme!, false);
        };

        colorInput.addEventListener('input', () => updateColor(colorInput.value));
        textInput.addEventListener('input', () => updateColor(textInput.value));

        container.appendChild(card);
      });
    };

    populateGrid('#theme-colors-workspace', workspaceKeys);
    populateGrid('#theme-colors-editor', editorKeys);
    populateGrid('#theme-colors-syntax', syntaxKeys);
  }

  open(initialTab: string = 'editor') {
    this.isOpen = true;
    this.overlay.style.display = 'flex';
    this.switchTab(initialTab);

    // Update section meta
    (this.overlay.querySelector('#update-cur-ver') as HTMLElement).textContent = updaterService.getCurrentVersion();
    (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
    (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();

    this.loadBranches();
    this.renderUpdateHistory();
    this.editingActionId = null;
    this.renderKeybindingsTable();

    const autoSaveToggle = this.overlay.querySelector('#setting-auto-save-toggle') as HTMLInputElement;
    autoSaveToggle.checked = preferencesService.get('files.autoSave');

    const autoSaveDelayInput = this.overlay.querySelector('#setting-auto-save-delay') as HTMLInputElement;
    autoSaveDelayInput.value = String(preferencesService.get('files.autoSaveDelay'));

    const vimToggle = this.overlay.querySelector('#setting-vim-toggle') as HTMLInputElement;
    vimToggle.checked = vimIntegration.isEnabled();

    const currentTheme = themeManager.getCurrentTheme();
    this.refreshThemeDropdown(currentTheme.id);
    this.loadThemeIntoStudio(currentTheme.id);

    const cursorSelect = this.overlay.querySelector('#setting-cursor-style') as HTMLSelectElement;
    cursorSelect.value = preferencesService.get('editor.cursorStyle');

    const cursorBlinkingSelect = this.overlay.querySelector('#setting-cursor-blinking') as HTMLSelectElement;
    if (cursorBlinkingSelect) {
      cursorBlinkingSelect.value = preferencesService.get('editor.cursorBlinking');
    }

    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    fontInput.value = preferencesService.get('editor.fontFamily');

    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    sizeInput.value = String(preferencesService.get('editor.fontSize'));

    const tabSizeInput = this.overlay.querySelector('#setting-tab-size') as HTMLInputElement;
    if (tabSizeInput) {
      tabSizeInput.value = String(preferencesService.get('editor.tabSize') || 2);
    }

    const wrapToggle = (this.overlay.querySelector('#setting-word-wrap') || this.overlay.querySelector('#setting-word-wrap-toggle')) as HTMLInputElement;
    if (wrapToggle) {
      wrapToggle.checked = preferencesService.get('editor.wordWrap');
    }

    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;
    cssText.value = themeManager.getCustomCss();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
    themeManager.applyTheme(themeManager.getCurrentTheme().id, false);
  }

  private save() {
    const autoSaveToggle = this.overlay.querySelector('#setting-auto-save-toggle') as HTMLInputElement;
    const autoSaveDelayInput = this.overlay.querySelector('#setting-auto-save-delay') as HTMLInputElement;
    const vimToggle = this.overlay.querySelector('#setting-vim-toggle') as HTMLInputElement;
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    const cursorSelect = this.overlay.querySelector('#setting-cursor-style') as HTMLSelectElement;
    const cursorBlinkingSelect = this.overlay.querySelector('#setting-cursor-blinking') as HTMLSelectElement;
    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    const tabSizeInput = this.overlay.querySelector('#setting-tab-size') as HTMLInputElement;
    const wrapToggle = (this.overlay.querySelector('#setting-word-wrap') || this.overlay.querySelector('#setting-word-wrap-toggle')) as HTMLInputElement;
    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;

    // Save Tab Size & Word Wrap
    if (tabSizeInput) {
      preferencesService.set('editor.tabSize', parseInt(tabSizeInput.value, 10) || 2);
    }
    if (wrapToggle) {
      preferencesService.set('editor.wordWrap', wrapToggle.checked);
    }

    // Save Auto Save
    preferencesService.set('files.autoSave', autoSaveToggle.checked);
    const delayNum = parseInt(autoSaveDelayInput.value.trim(), 10) || 1000;
    preferencesService.set('files.autoSaveDelay', delayNum);

    // Save Cursor Style & Blinking
    const newCursor = (cursorSelect.value as CursorStyle) || 'line';
    preferencesService.set('editor.cursorStyle', newCursor);
    if (cursorBlinkingSelect) {
      preferencesService.set('editor.cursorBlinking', (cursorBlinkingSelect.value as any) || 'blink');
    }

    // Save Vim
    const newVim = vimToggle.checked;
    preferencesService.set('editor.vimEnabled', newVim);
    vimIntegration.setEnabled(newVim);
    if (this.onVimToggled) this.onVimToggled(newVim);

    // Save Working Theme
    if (this.workingTheme) {
      if (themeManager.isCustomTheme(this.workingTheme.id)) {
        themeManager.saveCustomTheme(this.workingTheme);
      } else {
        themeManager.applyTheme(this.workingTheme.id, true);
      }
    } else if (themeSelect?.value) {
      themeManager.applyTheme(themeSelect.value, true);
    }

    // Save Typography
    const fontFamily = fontInput.value.trim() || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';
    const fontSizeNum = parseInt(sizeInput.value.trim(), 10) || 14;
    preferencesService.set('editor.fontFamily', fontFamily);
    preferencesService.set('editor.fontSize', fontSizeNum);

    document.documentElement.style.setProperty('--editor-font-family', fontFamily);
    document.documentElement.style.setProperty('--editor-font-size', `${fontSizeNum}px`);

    // Save Custom CSS
    themeManager.applyCustomCss(cssText.value);

    this.close();
  }
}
