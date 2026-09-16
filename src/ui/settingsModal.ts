import { themeManager } from '../themes/themeManager';
import { vimIntegration } from '../editor/vim';

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

          <div class="settings-section">
            <h3>💅 Custom CSS Override</h3>
            <p class="setting-desc">Inject custom CSS to customize any pixel, border, glow, opacity, or element.</p>
            <textarea id="setting-custom-css" class="setting-textarea" placeholder="/* Enter custom CSS rules here */\n/* Example: */\n/* .cm-cursor { border-left-color: #ff007f !important; box-shadow: 0 0 8px #ff007f; } */"></textarea>
          </div>
        </div>
        <div class="settings-footer">
          <button class="btn btn-secondary" id="settings-cancel">Cancel</button>
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
  }

  open() {
    this.isOpen = true;
    this.overlay.style.display = 'flex';

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
