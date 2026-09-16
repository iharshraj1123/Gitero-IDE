import { vimIntegration, VimMode } from '../editor/vim';
import { themeManager } from '../themes/themeManager';
import { EditorTab } from '../state/editorState';
import { preferencesService } from '../services/preferences';
import { gitService } from '../services/git';

export class StatusBarComponent {
  private container: HTMLElement;

  private vimModeEl!: HTMLElement;
  private gitGroupEl!: HTMLElement;
  private gitBranchEl!: HTMLElement;
  private gitSyncEl!: HTMLElement;
  private messageEl!: HTMLElement;
  private cursorEl!: HTMLElement;
  private spacesEl!: HTMLElement;
  private encodingEl!: HTMLElement;
  private languageEl!: HTMLElement;
  private themeEl!: HTMLElement;

  private onToggleVim?: () => void;
  private onOpenThemePicker?: () => void;
  private onOpenLanguagePicker?: () => void;
  private onOpenIndentationPicker?: () => void;
  private onOpenGit?: () => void;
  private onSwitchBranch?: () => void;
  private onSyncGit?: () => void;

  constructor(container: HTMLElement, options?: {
    onToggleVim?: () => void;
    onOpenThemePicker?: () => void;
    onOpenLanguagePicker?: () => void;
    onOpenIndentationPicker?: () => void;
    onOpenGit?: () => void;
    onSwitchBranch?: () => void;
    onSyncGit?: () => void;
  }) {
    this.container = container;
    this.onToggleVim = options?.onToggleVim;
    this.onOpenThemePicker = options?.onOpenThemePicker;
    this.onOpenLanguagePicker = options?.onOpenLanguagePicker;
    this.onOpenIndentationPicker = options?.onOpenIndentationPicker;
    this.onOpenGit = options?.onOpenGit;
    this.onSwitchBranch = options?.onSwitchBranch;
    this.onSyncGit = options?.onSyncGit;
    this.build();
    this.setupListeners();
  }

  private build() {
    this.container.innerHTML = `
      <div class="status-left">
        <div class="status-item status-vim-badge" id="status-vim" title="Click to toggle Vim Mode">
          <span class="vim-indicator">NORMAL</span>
        </div>
        <div class="status-git-group" id="status-git-group">
          <div class="status-item status-git-branch" id="status-git-branch" title="Git: Switch Branch">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            <span class="git-branch-name">main</span>
          </div>
          <div class="status-item status-git-sync" id="status-git-sync" title="Git: Synchronize Changes (Push / Pull)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          </div>
        </div>
        <div class="status-item status-message" id="status-msg"></div>
      </div>
      <div class="status-right">
        <div class="status-item" id="status-cursor">Ln 1, Col 1</div>
        <div class="status-item" id="status-spaces" title="Click to select Indentation">Spaces: 2</div>
        <div class="status-item" id="status-encoding">UTF-8</div>
        <div class="status-item" id="status-language" title="Click to change Language Mode">Plain Text</div>
        <div class="status-item status-theme" id="status-theme" title="Click to change color theme">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          <span class="theme-name">Tokyo Night</span>
        </div>
      </div>
    `;

    this.vimModeEl = this.container.querySelector('#status-vim') as HTMLElement;
    this.gitGroupEl = this.container.querySelector('#status-git-group') as HTMLElement;
    this.gitBranchEl = this.container.querySelector('#status-git-branch') as HTMLElement;
    this.gitSyncEl = this.container.querySelector('#status-git-sync') as HTMLElement;
    this.messageEl = this.container.querySelector('#status-msg') as HTMLElement;
    this.cursorEl = this.container.querySelector('#status-cursor') as HTMLElement;
    this.spacesEl = this.container.querySelector('#status-spaces') as HTMLElement;
    this.encodingEl = this.container.querySelector('#status-encoding') as HTMLElement;
    this.languageEl = this.container.querySelector('#status-language') as HTMLElement;
    this.themeEl = this.container.querySelector('#status-theme') as HTMLElement;

    this.vimModeEl.addEventListener('click', () => {
      this.onToggleVim?.();
    });

    this.gitBranchEl.addEventListener('click', () => {
      if (this.onSwitchBranch) {
        this.onSwitchBranch();
      } else {
        this.onOpenGit?.();
      }
    });

    this.gitSyncEl.addEventListener('click', () => {
      this.onSyncGit?.();
    });

    this.spacesEl.addEventListener('click', () => {
      this.onOpenIndentationPicker?.();
    });

    this.languageEl.addEventListener('click', () => {
      this.onOpenLanguagePicker?.();
    });

    this.themeEl.addEventListener('click', () => {
      this.onOpenThemePicker?.();
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

    // Tab size updates
    preferencesService.subscribe('editor.tabSize', (size) => {
      this.spacesEl.textContent = `Spaces: ${size}`;
    });

    // Git state updates
    gitService.onStatusChange((state) => {
      if (state.isRepo) {
        this.gitGroupEl.style.display = 'inline-flex';
        this.updateGitBranch(state.branch);
      } else {
        this.gitGroupEl.style.display = 'none';
      }
    });

    // Initial values
    this.updateVimMode(vimIntegration.getCurrentMode());
    const initialTheme = themeManager.getCurrentTheme();
    const nameSpan = this.themeEl.querySelector('.theme-name');
    if (nameSpan) nameSpan.textContent = initialTheme.name;
    const initialTabSize = preferencesService.get('editor.tabSize') || 2;
    this.spacesEl.textContent = `Spaces: ${initialTabSize}`;
  }

  updateGitBranch(branch: string) {
    const span = this.gitBranchEl.querySelector('.git-branch-name');
    if (span) span.textContent = branch;
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
