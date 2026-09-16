import { themeManager } from '../themes/themeManager';
import { vimIntegration } from '../editor/vim';
import { updaterService } from '../services/updater';

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
            <h3>🔄 Software Updates (GitHub Branch Channel)</h3>
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
                  <button class="btn btn-secondary btn-sm" id="btn-refresh-branches" title="Fetch active branches from GitHub">⟳ Refresh</button>
                </div>
              </div>

              <div class="update-status-card" id="update-status-card">
                <div class="update-status-msg" id="update-status-msg">Click "Check for Updates" to compare with GitHub.</div>
              </div>

              <div class="update-actions">
                <button class="btn btn-secondary" id="btn-check-update">Check for Updates</button>
                <button class="btn btn-primary" id="btn-apply-update" disabled>Update from this Branch</button>
              </div>

              <div class="update-preservation-note">
                <span class="shield-icon">🛡️</span>
                <span><strong>User State Isolated:</strong> Updates strictly refresh application code. Your chosen themes, custom CSS overrides, keybindings, and extensions remain 100% untouched.</span>
              </div>
            </div>
          </div>

          <!-- Vim Mode Section -->
          <div class="settings-section">
            <h3>🥷 Vim Mode</h3>
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
            <h3>🎨 Color Theme</h3>
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
            <h3>🔤 Typography & Editor</h3>
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
          </div>

          <!-- Custom CSS Override Section -->
          <div class="settings-section">
            <h3>💅 Custom CSS Override</h3>
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
      refreshBtn.textContent = '⟳ Refresh';
    });

    checkBtn.addEventListener('click', async () => {
      const branch = branchSelect.value;
      checkBtn.disabled = true;
      statusMsg.innerHTML = `<span class="loading-spinner">⏳</span> Checking GitHub for branch <strong>${branch}</strong>...`;

      try {
        const result = await updaterService.checkForUpdates(branch);
        if (result.isUpdateAvailable) {
          statusMsg.innerHTML = `
            <div class="update-avail-box">
              <span class="status-badge badge-avail">⚡ Update Available</span>
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
              <span class="status-badge badge-latest">✓ Up to Date</span>
              <span>You are already running the latest commit (<code>${result.currentSha}</code>) on branch <strong>${branch}</strong>.</span>
            </div>
          `;
          applyBtn.disabled = false;
          applyBtn.textContent = `Force Re-sync ${branch}`;
        }
      } catch (err: any) {
        statusMsg.innerHTML = `<span class="error-text">❌ ${err.message || 'Could not connect to GitHub'}</span>`;
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
          statusMsg.innerHTML = `<span class="loading-spinner">📦</span> ${step}`;
        });

        statusMsg.innerHTML = `
          <div class="update-success-box">
            <span class="status-badge badge-latest">🎉 Update Applied Successfully!</span>
            <p>Gitero IDE updated to branch <strong>${branch}</strong>.</p>
            <button class="btn btn-primary btn-sm" id="btn-restart-now" style="margin-top: 8px;">Restart Gitero IDE</button>
          </div>
        `;

        this.overlay.querySelector('#btn-restart-now')?.addEventListener('click', () => {
          updaterService.restartApp();
        });
      } catch (err: any) {
        statusMsg.innerHTML = `<span class="error-text">❌ Update failed: ${err.message}</span>`;
        applyBtn.disabled = false;
        checkBtn.disabled = false;
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

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';

    // Update section meta
    (this.overlay.querySelector('#update-cur-ver') as HTMLElement).textContent = updaterService.getCurrentVersion();
    (this.overlay.querySelector('#update-cur-sha') as HTMLElement).textContent = updaterService.getCurrentSha();
    (this.overlay.querySelector('#update-cur-branch') as HTMLElement).textContent = updaterService.getCurrentBranch();

    this.loadBranches();

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

    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    fontInput.value = localStorage.getItem('gitero_font_family') || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';

    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    sizeInput.value = localStorage.getItem('gitero_font_size') || '14';

    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;
    cssText.value = themeManager.getCustomCss();
  }

  close() {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  private save() {
    const vimToggle = this.overlay.querySelector('#setting-vim-toggle') as HTMLInputElement;
    const themeSelect = this.overlay.querySelector('#setting-theme-select') as HTMLSelectElement;
    const fontInput = this.overlay.querySelector('#setting-font-family') as HTMLInputElement;
    const sizeInput = this.overlay.querySelector('#setting-font-size') as HTMLInputElement;
    const cssText = this.overlay.querySelector('#setting-custom-css') as HTMLTextAreaElement;

    // Save Vim
    const newVim = vimToggle.checked;
    vimIntegration.setEnabled(newVim);
    if (this.onVimToggled) this.onVimToggled(newVim);

    // Save Theme
    themeManager.applyTheme(themeSelect.value);

    // Save Typography
    const fontFamily = fontInput.value.trim();
    const fontSize = `${sizeInput.value.trim()}px`;
    localStorage.setItem('gitero_font_family', fontFamily);
    localStorage.setItem('gitero_font_size', sizeInput.value.trim());

    document.documentElement.style.setProperty('--editor-font-family', fontFamily);
    document.documentElement.style.setProperty('--editor-font-size', fontSize);

    // Save Custom CSS
    themeManager.applyCustomCss(cssText.value);

    this.close();
  }
}
