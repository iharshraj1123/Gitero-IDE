import { vimIntegration, VimMode } from '../editor/vim';
import { themeManager } from '../themes/themeManager';
import { EditorTab } from '../state/editorState';

export class StatusBarComponent {
  private container: HTMLElement;

  private vimModeEl!: HTMLElement;
  private gitBranchEl!: HTMLElement;
  private messageEl!: HTMLElement;
  private cursorEl!: HTMLElement;
  private spacesEl!: HTMLElement;
  private encodingEl!: HTMLElement;
  private languageEl!: HTMLElement;
  private themeEl!: HTMLElement;

  private onToggleVim?: () => void;
  private onOpenThemePicker?: () => void;

  constructor(container: HTMLElement, options?: {
    onToggleVim?: () => void;
    onOpenThemePicker?: () => void;
  }) {
    this.container = container;
    this.onToggleVim = options?.onToggleVim;
    this.onOpenThemePicker = options?.onOpenThemePicker;
    this.build();
    this.setupListeners();
  }

  private build() {
    this.container.innerHTML = `
      <div class="status-left">
        <div class="status-item status-vim-badge" id="status-vim" title="Click to toggle Vim Mode">
          <span class="vim-indicator">NORMAL</span>
        </div>
        <div class="status-item" id="status-git">
          <span class="status-icon"></span>
          <span class="git-branch-name">main</span>
        </div>
        <div class="status-item status-message" id="status-msg"></div>
      </div>
      <div class="status-right">
        <div class="status-item" id="status-cursor">Ln 1, Col 1</div>
        <div class="status-item" id="status-spaces">Spaces: 2</div>
        <div class="status-item" id="status-encoding">UTF-8</div>
        <div class="status-item" id="status-language">Plain Text</div>
        <div class="status-item status-theme" id="status-theme" title="Click to change color theme">
          <span class="theme-icon">🎨</span>
          <span class="theme-name">Tokyo Night</span>
        </div>
      </div>
    `;

    this.vimModeEl = this.container.querySelector('#status-vim') as HTMLElement;
    this.gitBranchEl = this.container.querySelector('#status-git') as HTMLElement;
    this.messageEl = this.container.querySelector('#status-msg') as HTMLElement;
    this.cursorEl = this.container.querySelector('#status-cursor') as HTMLElement;
    this.spacesEl = this.container.querySelector('#status-spaces') as HTMLElement;
    this.encodingEl = this.container.querySelector('#status-encoding') as HTMLElement;
    this.languageEl = this.container.querySelector('#status-language') as HTMLElement;
    this.themeEl = this.container.querySelector('#status-theme') as HTMLElement;

    this.vimModeEl.addEventListener('click', () => {
      if (this.onToggleVim) this.onToggleVim();
    });

    this.themeEl.addEventListener('click', () => {
      if (this.onOpenThemePicker) this.onOpenThemePicker();
    });
  }

  private setupListeners() {
    // Vim mode updates
    vimIntegration.onModeChange((mode) => {
      this.updateVimMode(mode);
    });

    // Theme changes
    themeManager.onThemeChange((theme) => {
      const nameSpan = this.themeEl.querySelector('.theme-name');
      if (nameSpan) nameSpan.textContent = theme.name;
    });

    // Initial values
    this.updateVimMode(vimIntegration.getCurrentMode());
    const initialTheme = themeManager.getCurrentTheme();
    const nameSpan = this.themeEl.querySelector('.theme-name');
    if (nameSpan) nameSpan.textContent = initialTheme.name;
  }

  updateVimMode(mode: VimMode) {
    const isEnabled = vimIntegration.isEnabled();
    const indicator = this.vimModeEl.querySelector('.vim-indicator');
    if (!indicator) return;

    if (!isEnabled) {
      indicator.textContent = 'VIM: OFF';
      this.vimModeEl.className = 'status-item status-vim-badge mode-disabled';
      return;
    }

    indicator.textContent = mode;
    this.vimModeEl.className = `status-item status-vim-badge mode-${mode.toLowerCase()}`;
  }

  updateCursor(line: number, col: number) {
    this.cursorEl.textContent = `Ln ${line}, Col ${col}`;
  }

  updateTabInfo(tab: EditorTab | null) {
    if (tab) {
      this.languageEl.textContent = tab.language;
      this.cursorEl.textContent = `Ln ${tab.cursor.line}, Col ${tab.cursor.col}`;
    } else {
      this.languageEl.textContent = 'Ready';
      this.cursorEl.textContent = '';
    }
  }

  showMessage(msg: string, timeoutMs: number = 3000) {
    this.messageEl.textContent = msg;
    if (timeoutMs > 0) {
      setTimeout(() => {
        if (this.messageEl.textContent === msg) {
          this.messageEl.textContent = '';
        }
      }, timeoutMs);
    }
  }
}
