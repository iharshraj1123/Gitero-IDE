import { Extension } from '@codemirror/state';
import { vim as cmVim, Vim, getCM } from '@replit/codemirror-vim';
import { EditorView } from '@codemirror/view';

export type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL' | 'V-LINE' | 'V-BLOCK' | 'COMMAND';

export interface VimStateListener {
  (mode: VimMode): void;
}

export class VimIntegration {
  private enabled: boolean;
  private modeListeners: VimStateListener[] = [];
  private currentMode: VimMode = 'NORMAL';
  private onSaveCallback: (() => void) | null = null;
  private onCloseCallback: (() => void) | null = null;

  constructor() {
    this.enabled = localStorage.getItem('gitero_vim_enabled') !== 'false'; // default true
    this.setupExCommands();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('gitero_vim_enabled', enabled ? 'true' : 'false');
  }

  setCallbacks(onSave: () => void, onClose: () => void) {
    this.onSaveCallback = onSave;
    this.onCloseCallback = onClose;
  }

  private setupExCommands() {
    // :w (Save file)
    Vim.defineEx('write', 'w', () => {
      if (this.onSaveCallback) {
        this.onSaveCallback();
      }
    });

    // :q (Quit / Close tab)
    Vim.defineEx('quit', 'q', () => {
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    });

    // :wq / :x (Save and Close)
    Vim.defineEx('wq', 'wq', () => {
      if (this.onSaveCallback) this.onSaveCallback();
      if (this.onCloseCallback) this.onCloseCallback();
    });

    Vim.defineEx('x', 'x', () => {
      if (this.onSaveCallback) this.onSaveCallback();
      if (this.onCloseCallback) this.onCloseCallback();
    });
  }

  getExtension(): Extension {
    if (!this.enabled) return [];
    return cmVim();
  }

  attachView(view: EditorView) {
    if (!this.enabled) return;
    
    // Give CodeMirror a moment to register CM adapter
    setTimeout(() => {
      const cm = getCM(view);
      if (cm) {
        // Listen to vim mode change events
        cm.on('vim-mode-change', (arg: { mode: string; subMode?: string }) => {
          let mode: VimMode = 'NORMAL';
          if (arg.mode === 'insert') {
            mode = 'INSERT';
          } else if (arg.mode === 'visual') {
            if (arg.subMode === 'linewise') mode = 'V-LINE';
            else if (arg.subMode === 'blockwise') mode = 'V-BLOCK';
            else mode = 'VISUAL';
          } else if (arg.mode === 'normal') {
            mode = 'NORMAL';
          }

          this.currentMode = mode;
          this.modeListeners.forEach(fn => fn(mode));
        });
      }
    }, 50);
  }

  getCurrentMode(): VimMode {
    return this.currentMode;
  }

  onModeChange(fn: VimStateListener) {
    this.modeListeners.push(fn);
  }
}

export const vimIntegration = new VimIntegration();
