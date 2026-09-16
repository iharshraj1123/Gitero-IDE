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
          <h2>Gitero Settings & Customization</h2>
          <button class="settings-close-btn" aria-label="Close">×</button>
        </div>
        <div class="settings-body">
          <!-- Software Updates Section -->
          <div class="settings-section update-section">
            <h3>Software Updates (GitHub Branch Channel)</h3>
            <p class="setting-desc">Switch and update Gitero IDE directly from any branch on GitHub.</p>

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
                <span><strong>User State Isolated:</strong> Updates strictly refresh application code. Your chosen themes, custom CSS overrides, keybindings, and extensions remain 100% untouched.</span>
              </div>
            </div>
          </div>

          <!-- Files & Auto-Save Section -->
          <div class="settings-section">
            <h3>Files & Auto-Save</h3>
            <div class="setting-row">
              <label class="setting-label">
                <span>Enable Auto Save</span>
                <span class="setting-desc">Automatically save dirty files after a brief delay (Default: Off)</span>
              </label>
              <input type="checkbox" id="setting-auto-save-toggle" class="setting-checkbox" />
            </div>
            <div class="setting-row">
              <label class="setting-label">
                <span>Auto Save Delay (ms)</span>
                <span class="setting-desc">Delay in milliseconds before automatically saving (e.g. 1000)</span>
              </label>
              <input type="number" id="setting-auto-save-delay" class="setting-input-small" min="100" max="10000" step="100" value="1000" />
            </div>
          </div>

          <!-- Vim Mode Section -->
          <div class="settings-section">
            <h3>Vim Mode</h3>
            <div class="setting-row">
              <label class="setting-label">
                <span>Enable Vim Modal Editing</span>
                <span class="setting-desc">Full Vim motions, modes, operators, and Ex commands (:w, :q)</span>
              </label>
              <input type="checkbox" id="setting-vim-toggle" class="setting-checkbox" />
            </div>
          </div>

          <!-- Color Theme Section -->
          <div class="settings-section">
            <h3>Color Theme</h3>
            <div class="setting-row">
              <label class="setting-label">
                <span>Active Theme</span>
                <span class="setting-desc">Choose from bundled authentic themes</span>
              </label>
              <select id="setting-theme-select" class="setting-select"></select>
            </div>
          </div>

          <!-- Typography Section -->
          <div class="settings-section">
            <h3>Typography & Editor</h3>
            <div class="setting-row">
              <label class="setting-label">
                <span>Cursor Style</span>
                <span class="setting-desc">Preferred cursor shape in the editor</span>
              </label>
              <select id="setting-cursor-style" class="setting-select">
                <option value="line">Line / Bar (Default)</option>
                <option value="block">Block</option>
                <option value="underline">Underline</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-label">
                <span>Font Family</span>
                <span class="setting-desc">Monospace font family with ligature support</span>
              </label>
              <input type="text" id="setting-font-family" class="setting-input" value="Cascadia Code, Fira Code, JetBrains Mono, Consolas, monospace" />
            </div>
            <div class="setting-row">
              <label class="setting-label">
                <span>Font Size (px)</span>
                <span class="setting-desc">Editor text size</span>
              </label>
              <input type="number" id="setting-font-size" class="setting-input-small" min="10" max="32" value="14" />
            </div>
            <div class="setting-row">
              <label class="setting-label">
                <span>Tab Size</span>
                <span class="setting-desc">Number of spaces per indentation level</span>
              </label>
              <select id="setting-tab-size" class="setting-select">
                <option value="2">2 Spaces</option>
                <option value="4">4 Spaces</option>
                <option value="8">8 Spaces</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-label">
                <span>Word Wrap</span>
                <span class="setting-desc">Wrap long lines to fit viewport width (Alt+Z)</span>
              </label>
              <input type="checkbox" id="setting-word-wrap-toggle" class="setting-checkbox" />
            </div>
          </div>

          <!-- Keyboard Shortcuts Section -->
          <div class="settings-section keybindings-section">
            <div class="keybindings-header">
              <div>
                <h3>Keyboard Shortcuts</h3>
                <p class="setting-desc">Customize keybindings for commands. Click "Change" or press keys to reassign.</p>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-reset-keybindings" title="Reset all keybindings to defaults">Reset to Defaults</button>
            </div>

            <div class="keybindings-search-box">
              <input type="text" id="setting-keybinding-search" class="setting-input" placeholder="Search keybindings (e.g. Save, Ctrl+S, Markdown)..." />
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

          <!-- Custom CSS Override Section -->
          <div class="settings-section">
            <h3>Custom CSS Override</h3>
            <p class="setting-desc">Inject custom CSS to customize any pixel, border, glow, opacity, or element.</p>
            <textarea id="setting-custom-css" class="setting-textarea" placeholder="/* Enter custom CSS rules here */\n/* Example: */\n/* .cm-cursor { border-left-color: #ff007f !important; box-shadow: 0 0 8px #ff007f; } */"></textarea>
          </div>
        </div>
        <div class="settings-footer">
          <button class="btn btn-secondary" id="settings-cancel">Close</button>
          <button class="btn btn-primary" id="settings-save">Save & Apply</button>
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

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';

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
