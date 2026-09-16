import { isNative } from '../services/neutralino';
import { fsService } from '../services/fs';

export class TerminalPanelComponent {
  private container: HTMLElement;
  private currentCwd: string = '';
  private history: string[] = [];
  private historyIndex: number = -1;
  private activeTab: 'terminal' | 'output' = 'terminal';
  private isOpen: boolean = false;
  private isMaximized: boolean = false;
  private defaultHeight: number = 220;

  private terminalTabBtn!: HTMLElement;
  private outputTabBtn!: HTMLElement;
  private terminalView!: HTMLElement;
  private outputView!: HTMLElement;
  private terminalOutputArea!: HTMLElement;
  private outputLogsArea!: HTMLElement;
  private promptLabel!: HTMLElement;
  private commandInput!: HTMLInputElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.currentCwd = fsService.getWorkspace() || '.';
    this.build();
    this.setupListeners();
    this.setupResizer();
    this.printWelcome();
  }

  private build() {
    this.container.innerHTML = `
      <div class="bottom-panel-resizer" id="panel-resizer"></div>
      <div class="bottom-panel-header">
        <div class="panel-tabs">
          <button class="panel-tab active" id="tab-btn-terminal">TERMINAL</button>
          <button class="panel-tab" id="tab-btn-output">OUTPUT</button>
        </div>
        <div class="panel-actions">
          <button class="panel-action-btn" id="btn-panel-clear" title="Clear Buffer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
          <button class="panel-action-btn" id="btn-panel-max" title="Toggle Size">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
          </button>
          <button class="panel-action-btn" id="btn-panel-close" title="Close Panel (Ctrl+\`)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div class="bottom-panel-content">
        <!-- Terminal View -->
        <div class="terminal-view-container" id="terminal-view">
          <div class="terminal-output-area" id="terminal-output-area"></div>
          <div class="terminal-input-row">
            <span class="terminal-prompt" id="terminal-prompt-label">PS &gt; </span>
            <input type="text" class="terminal-command-input" id="terminal-cmd-input" spellcheck="false" autocomplete="off" />
          </div>
        </div>

        <!-- Output View -->
        <div class="output-view-container" id="output-view" style="display: none;">
          <div class="output-logs-area" id="output-logs-area">
            <div class="output-log-line info">[Gitero IDE] Output console initialized. Ready.</div>
          </div>
        </div>
      </div>
    `;

    this.terminalTabBtn = this.container.querySelector('#tab-btn-terminal') as HTMLElement;
    this.outputTabBtn = this.container.querySelector('#tab-btn-output') as HTMLElement;
    this.terminalView = this.container.querySelector('#terminal-view') as HTMLElement;
    this.outputView = this.container.querySelector('#output-view') as HTMLElement;
    this.terminalOutputArea = this.container.querySelector('#terminal-output-area') as HTMLElement;
    this.outputLogsArea = this.container.querySelector('#output-logs-area') as HTMLElement;
    this.promptLabel = this.container.querySelector('#terminal-prompt-label') as HTMLElement;
    this.commandInput = this.container.querySelector('#terminal-cmd-input') as HTMLInputElement;

    this.updatePrompt();
  }

  private printWelcome() {
    this.appendTerminalLine('Gitero IDE Integrated Terminal [PowerShell / Native Execution]');
    this.appendTerminalLine('Type commands and press Enter. Use Up/Down arrows for command history.\n');
  }

  private updatePrompt() {
    const ws = fsService.getWorkspace();
    if (!this.currentCwd || this.currentCwd === '.') {
      this.currentCwd = ws || 'C:\\';
    }
    const shortPath = this.currentCwd.length > 35 ? '...' + this.currentCwd.slice(-32) : this.currentCwd;
    this.promptLabel.textContent = `PS ${shortPath}> `;
  }

  private setupListeners() {
    this.terminalTabBtn.addEventListener('click', () => {
      this.switchTab('terminal');
    });

    this.outputTabBtn.addEventListener('click', () => {
      this.switchTab('output');
    });

    this.container.querySelector('#btn-panel-clear')?.addEventListener('click', () => {
      if (this.activeTab === 'terminal') {
        this.terminalOutputArea.innerHTML = '';
      } else {
        this.outputLogsArea.innerHTML = '';
      }
    });

    this.container.querySelector('#btn-panel-close')?.addEventListener('click', () => {
      this.toggle(false);
    });

    this.container.querySelector('#btn-panel-max')?.addEventListener('click', () => {
      this.isMaximized = !this.isMaximized;
      this.container.style.height = this.isMaximized ? '75%' : `${this.defaultHeight}px`;
    });

    // Command line enter & arrow history
    this.commandInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = this.commandInput.value.trim();
        this.commandInput.value = '';
        if (cmd) {
          this.history.push(cmd);
          this.historyIndex = this.history.length;
          await this.executeCommand(cmd);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.commandInput.value = this.history[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this.commandInput.value = this.history[this.historyIndex] || '';
        } else {
          this.historyIndex = this.history.length;
          this.commandInput.value = '';
        }
      }
    });

    // Click terminal container to focus input
    this.terminalView.addEventListener('click', () => {
      this.commandInput.focus();
    });
  }

  private setupResizer() {
    const resizer = this.container.querySelector('#panel-resizer') as HTMLElement;
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    resizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      startHeight = this.container.offsetHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(120, Math.min(window.innerHeight - 100, startHeight + deltaY));
      this.defaultHeight = newHeight;
      this.container.style.height = `${newHeight}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  private switchTab(tab: 'terminal' | 'output') {
    this.activeTab = tab;
    this.terminalTabBtn.classList.toggle('active', tab === 'terminal');
    this.outputTabBtn.classList.toggle('active', tab === 'output');
    this.terminalView.style.display = tab === 'terminal' ? 'flex' : 'none';
    this.outputView.style.display = tab === 'output' ? 'flex' : 'none';
    if (tab === 'terminal') {
      this.commandInput.focus();
    }
  }

  toggle(forceState?: boolean): boolean {
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    this.container.style.display = this.isOpen ? 'flex' : 'none';
    if (this.isOpen) {
      this.container.style.height = `${this.defaultHeight}px`;
      if (this.activeTab === 'terminal') {
        setTimeout(() => this.commandInput.focus(), 50);
      }
    }
    return this.isOpen;
  }

  setCwd(newCwd: string) {
    this.currentCwd = newCwd;
    this.updatePrompt();
  }

  private appendTerminalLine(text: string, isError: boolean = false, isCommand: boolean = false) {
    const lineEl = document.createElement('div');
    lineEl.className = `terminal-line ${isError ? 'line-error' : ''} ${isCommand ? 'line-command' : ''}`;
    lineEl.textContent = text;
    this.terminalOutputArea.appendChild(lineEl);
    this.terminalOutputArea.scrollTop = this.terminalOutputArea.scrollHeight;
  }

  async executeCommand(commandStr: string) {
    // Print prompt and command
    this.appendTerminalLine(`PS ${this.currentCwd}> ${commandStr}`, false, true);

    const trimmed = commandStr.trim();

    // Built-in cls / clear
    if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear') {
      this.terminalOutputArea.innerHTML = '';
      return;
    }

    // Built-in cd command
    if (/^cd\s*/i.test(trimmed)) {
      const targetDir = trimmed.replace(/^cd\s*/i, '').trim().replace(/^"/, '').replace(/"$/, '');
      if (!targetDir || targetDir === '.') return;

      if (isNative()) {
        try {
          const testCmd = `cd /d "${this.currentCwd}" && cd "${targetDir}" && cd`;
          const res = await window.Neutralino.os.execCommand(testCmd);
          if (res.exitCode === 0 && res.stdOut) {
            this.currentCwd = res.stdOut.trim();
            this.updatePrompt();
          } else {
            this.appendTerminalLine(`Cannot find path '${targetDir}' because it does not exist.`, true);
          }
        } catch (e: any) {
          this.appendTerminalLine(e.message || String(e), true);
        }
      } else {
        this.currentCwd = targetDir;
        this.updatePrompt();
      }
      return;
    }

    // Execute native system command via PowerShell / cmd
    if (!isNative()) {
      this.appendTerminalLine(`[Web Preview Fallback] Command executed: ${commandStr}`);
      return;
    }

    try {
      const fullCmd = `cd /d "${this.currentCwd}" && ${commandStr}`;
      const res = await window.Neutralino.os.execCommand(fullCmd);

      if (res.stdOut && res.stdOut.trim()) {
        this.appendTerminalLine(res.stdOut.trim());
      }
      if (res.stdErr && res.stdErr.trim()) {
        this.appendTerminalLine(res.stdErr.trim(), true);
      }
      if (res.exitCode !== 0 && !res.stdOut && !res.stdErr) {
        this.appendTerminalLine(`Command exited with error code ${res.exitCode}`, true);
      }
    } catch (err: any) {
      this.appendTerminalLine(`Error executing command: ${err?.message || err}`, true);
    }
  }

  logOutput(msg: string, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `output-log-line ${level}`;
    line.textContent = `[${timestamp}] ${msg}`;
    this.outputLogsArea.appendChild(line);
    this.outputLogsArea.scrollTop = this.outputLogsArea.scrollHeight;
  }
}
