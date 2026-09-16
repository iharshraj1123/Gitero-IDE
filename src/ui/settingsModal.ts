import { themeManager } from '../themes/themeManager';
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
  { id: 'workbench.action.gotoLine', name: 'Go to Line/Column...', category: 'Go' },
  { id: 'editor.action.toggleWordWrap', name: 'Toggle Word Wrap', category: 'Editor' },
  { id: 'markdown.showPreview', name: 'Toggle Markdown Preview / Raw Editor', category: 'Markdown' },
  { id: 'workbench.action.openSettings', name: 'Open Settings & Custom CSS', category: 'Preferences' },
  { id: 'workbench.action.openShortcuts', name: 'Keyboard Shortcuts Reference', category: 'Help' }
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
          <!-- Left: Scrollable Tab Content Area -->
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
                    <span class="setting-desc">Shape of the cursor in the active editor</span>
                  </div>
                  <select id="setting-cursor-style" class="setting-select">
                    <option value="line">Line / Bar (Default)</option>
                    <option value="block">Block</option>
                    <option value="underline">Underline</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Tab Size</span>
                    <span class="setting-desc">Number of spaces per indentation level</span>
                  </div>
                  <select id="setting-tab-size" class="setting-select">
                    <option value="2">2 Spaces</option>
                    <option value="4">4 Spaces</option>
                    <option value="8">8 Spaces</option>
                  </select>
                </div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Word Wrap</span>
                    <span class="setting-desc">Wrap long lines to fit viewport width (Alt+Z)</span>
                  </div>
                  <input type="checkbox" id="setting-word-wrap-toggle" class="setting-checkbox" />
                </div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Modal Editing</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Enable Vim Mode</span>
                    <span class="setting-desc">Full Vim motions, modes (normal/insert/visual), operators, and Ex commands (:w, :q)</span>
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
                <div class="settings-section-title">Appearance & Themes</div>
                <div class="settings-section-subtitle">Select and preview color schemes for the Gitero studio interface and code editor.</div>
              </div>

              <div class="setting-card">
                <div class="setting-card-title">Color Theme</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="setting-title">Active Theme</span>
                    <span class="setting-desc">Choose from bundled professional themes</span>
                  </div>
                  <select id="setting-theme-select" class="setting-select"></select>
                </div>
                <div id="theme-preview-palette"></div>
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
                  <div class="update-meta-item">
                    <span class="update-meta-label">Version</span>
                    <span class="update-meta-val" id="update-cur-ver">v1.0.0</span>
                  </div>
                  <div class="update-meta-item">
                    <span class="update-meta-label">Current Commit</span>
                    <span class="update-meta-val" id="update-cur-sha">791a8ec</span>
                  </div>
                  <div class="update-meta-item">
                    <span class="update-meta-label">Active Channel</span>
                    <span class="update-meta-val" id="update-cur-branch">main</span>
                  </div>
                </div>

                <div class="update-channel-row">
                  <label for="update-branch-select" class="update-label">Target Branch:</label>
                  <div class="update-branch-controls">
                    <select id="update-branch-select" class="setting-select update-branch-select">
                      <option value="main">main</option>
                    </select>
                    <button class="btn btn-secondary btn-sm" id="btn-refresh-branches" title="Fetch active branches from GitHub">Refresh</button>
                  </div>
                </div>

                <div class="update-status-card" id="update-status-card">
                  <div class="update-status-msg" id="update-status-msg">Click "Check for Updates" to compare with GitHub.</div>
                </div>

                <div class="update-actions">
                  <button class="btn btn-secondary" id="btn-check-update">Check for Updates</button>
                  <button class="btn btn-primary" id="btn-apply-update" disabled>Update from this Branch</button>
                </div>

                <!-- Update History & Rollback Sub-section -->
                <div class="update-history-container">
                  <div class="update-history-header">
                    <div class="update-history-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                      <span>Update History & Rollback</span>
                      <span class="history-count-badge" id="history-count-badge">0</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-toggle-history">Show History</button>
                  </div>

                  <div class="update-history-list" id="update-history-list" style="display: none;"></div>
                </div>

                <div class="update-preservation-note">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span><strong>User State Isolated:</strong> Updates strictly refresh application code. Your chosen themes, custom CSS overrides, keybindings, and preferences remain 100% untouched.</span>
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

          <!-- Right: Stacked Tabs Sidebar Navigation -->
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

  private updateThemePreview(themeId: string) {
    const previewContainer = this.overlay.querySelector('#theme-preview-palette') as HTMLElement | null;
    if (!previewContainer) return;

    const theme = themeManager.getAllThemes().find(t => t.id === themeId) || themeManager.getCurrentTheme();
    const c = theme.colors;

    previewContainer.innerHTML = `
      <div class="theme-swatch-card" style="background: ${c.bgPrimary}; border-color: ${c.borderColor};">
        <div class="theme-swatch-header" style="background: ${c.bgSecondary}; border-bottom: 1px solid ${c.borderColor};">
          <span style="color: ${c.fgPrimary}; font-weight: 600;">${theme.name}</span>
          <span class="theme-type-badge" style="background: ${c.bgActive}; color: ${c.accent};">${theme.isDark ? 'Dark Palette' : 'Light Palette'}</span>
        </div>
        <div class="theme-swatch-palette">
          <div class="swatch-item"><div class="swatch-color" style="background: ${c.bgPrimary};"></div><span>Primary (${c.bgPrimary})</span></div>
          <div class="swatch-item"><div class="swatch-color" style="background: ${c.bgSidebar};"></div><span>Sidebar (${c.bgSidebar})</span></div>
          <div class="swatch-item"><div class="swatch-color" style="background: ${c.accent};"></div><span>Accent (${c.accent})</span></div>
          <div class="swatch-item"><div class="swatch-color" style="background: ${c.fgPrimary};"></div><span>Text (${c.fgPrimary})</span></div>
          <div class="swatch-item"><div class="swatch-color" style="background: ${c.editorActiveLine};"></div><span>Active Line</span></div>
        </div>
      </div>
    `;
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

    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    themeSelect.innerHTML = '';
    const currentTheme = themeManager.getCurrentTheme();

    themeManager.getAllThemes().forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === currentTheme.id) opt.selected = true;
      themeSelect.appendChild(opt);
    });

    this.updateThemePreview(currentTheme.id);

    // Update preview when theme selection changes
    themeSelect.onchange = () => {
      this.updateThemePreview(themeSelect.value);
    };

    const cursorSelect = this.overlay.querySelector('#setting-cursor-style') as HTMLSelectElement;
    cursorSelect.value = preferencesService.get('editor.cursorStyle');

    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    fontInput.value = preferencesService.get('editor.fontFamily');

    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    sizeInput.value = String(preferencesService.get('editor.fontSize'));

    const tabSelect = this.overlay.querySelector('#setting-tab-size') as HTMLSelectElement;
    tabSelect.value = String(preferencesService.get('editor.tabSize') || 2);

    const wrapToggle = this.overlay.querySelector('#setting-word-wrap-toggle') as HTMLInputElement;
    wrapToggle.checked = preferencesService.get('editor.wordWrap');

    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;
    cssText.value = themeManager.getCustomCss();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  private save() {
    const autoSaveToggle = this.overlay.querySelector('#setting-auto-save-toggle') as HTMLInputElement;
    const autoSaveDelayInput = this.overlay.querySelector('#setting-auto-save-delay') as HTMLInputElement;
    const vimToggle = this.overlay.querySelector('#setting-vim-toggle') as HTMLInputElement;
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    const cursorSelect = this.overlay.querySelector('#setting-cursor-style') as HTMLSelectElement;
    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    const tabSelect = this.overlay.querySelector('#setting-tab-size') as HTMLSelectElement;
    const wrapToggle = this.overlay.querySelector('#setting-word-wrap-toggle') as HTMLInputElement;
    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;

    // Save Tab Size & Word Wrap
    preferencesService.set('editor.tabSize', parseInt(tabSelect.value, 10) || 2);
    preferencesService.set('editor.wordWrap', wrapToggle.checked);

    // Save Auto Save
    preferencesService.set('files.autoSave', autoSaveToggle.checked);
    const delayNum = parseInt(autoSaveDelayInput.value.trim(), 10) || 1000;
    preferencesService.set('files.autoSaveDelay', delayNum);

    // Save Cursor Style
    const newCursor = (cursorSelect.value as CursorStyle) || 'line';
    preferencesService.set('editor.cursorStyle', newCursor);

    // Save Vim
    const newVim = vimToggle.checked;
    preferencesService.set('editor.vimEnabled', newVim);
    vimIntegration.setEnabled(newVim);
    if (this.onVimToggled) this.onVimToggled(newVim);

    // Save Theme
    themeManager.applyTheme(themeSelect.value);

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
