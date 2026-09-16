import { isNative } from '../services/neutralino';
import { fsService } from '../services/fs';
import { preferencesService } from '../services/preferences';

export class TerminalPanelComponent {
  private container: HTMLElement;
  private currentCwd: string = '';
  private history: string[] = [];
  private historyIndex: number = -1;
  private activeTab: 'terminal' | 'output' = 'terminal';
  private isOpen: boolean = false;
  private isMaximized: boolean = false;
  private defaultHeight: number = 220;

  private activeProcess: { id: number; command: string } | null = null;
  private lastLineEl: HTMLElement | null = null;
  private lastLineEnded: boolean = true;

  private terminalTabBtn!: HTMLElement;
  private outputTabBtn!: HTMLElement;
  private terminalView!: HTMLElement;
  private outputView!: HTMLElement;
  private terminalOutputArea!: HTMLElement;
  private outputLogsArea!: HTMLElement;
  private promptLabel!: HTMLElement;
  private commandInput!: HTMLInputElement;
  private stopBtn!: HTMLButtonElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.currentCwd = fsService.getWorkspace() || '.';
    this.defaultHeight = preferencesService.get('workbench.bottomPanelHeight') || 220;
    this.loadHistory();
    this.applyTypography();
    preferencesService.subscribe('terminal.fontSize', () => this.applyTypography());
    preferencesService.subscribe('terminal.fontFamily', () => this.applyTypography());
    this.build();
    this.setupListeners();
    this.setupResizer();
    this.setupNativeProcessEvents();
    this.printWelcome();
  }

  private applyTypography() {
    const size = preferencesService.get('terminal.fontSize') || 13;
    const font = preferencesService.get('terminal.fontFamily') || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';
    this.container.style.setProperty('--terminal-font-size', `${size}px`);
    this.container.style.setProperty('--terminal-font-family', font);
  }

  private loadHistory() {
    try {
      const raw = localStorage.getItem('gitero_terminal_history');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.history = arr;
          this.historyIndex = this.history.length;
        }
      }
    } catch (e) {
      console.warn('Failed to load terminal history', e);
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem('gitero_terminal_history', JSON.stringify(this.history.slice(-100)));
    } catch (e) {
      console.warn('Failed to persist terminal history', e);
    }
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
          <button class="panel-action-btn" id="btn-panel-stop" title="Terminate Process (Ctrl+C)" style="display: none;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>
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
    this.stopBtn = this.container.querySelector('#btn-panel-stop') as HTMLButtonElement;

    this.updatePrompt();
  }

  private printWelcome() {
    this.appendTerminalLine('Gitero IDE Integrated Terminal [Live Streaming Execution]');
    this.appendTerminalLine('Real-time background tasks supported. Use Ctrl+C or the Stop button to terminate running commands.\n');
  }

  private updatePrompt() {
    if (this.activeProcess) {
      this.promptLabel.innerHTML = `Running <span class="terminal-badge-running"></span> &gt; `;
      return;
    }
    const ws = fsService.getWorkspace();
    if (!this.currentCwd || this.currentCwd === '.') {
      this.currentCwd = ws || 'C:\\';
    }
    const shortPath = this.currentCwd.length > 35 ? '...' + this.currentCwd.slice(-32) : this.currentCwd;
    this.promptLabel.textContent = `PS ${shortPath}> `;
  }

  private updateActiveProcessUI(isActive: boolean) {
    if (isActive) {
      this.stopBtn.style.display = 'flex';
      this.stopBtn.classList.add('btn-stop-active');
      this.commandInput.placeholder = 'Type to send input to running process, or press Ctrl+C to stop...';
    } else {
      this.stopBtn.style.display = 'none';
      this.stopBtn.classList.remove('btn-stop-active');
      this.commandInput.placeholder = '';
    }
    this.updatePrompt();
  }

  private setupNativeProcessEvents() {
    if (typeof window !== 'undefined' && window.Neutralino?.events) {
      window.Neutralino.events.on('spawnedProcess', (evt: any) => {
        const detail = evt?.detail;
        if (!detail) return;
        if (this.activeProcess && detail.id === this.activeProcess.id) {
          if (detail.action === 'stdOut') {
            this.appendTerminalChunk(detail.data, false);
          } else if (detail.action === 'stdErr') {
            this.appendTerminalChunk(detail.data, true);
          } else if (detail.action === 'exit') {
            this.onProcessExit(detail.data);
          }
        }
      });
    }
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
        this.lastLineEl = null;
        this.lastLineEnded = true;
      } else {
        this.outputLogsArea.innerHTML = '';
      }
    });

    this.stopBtn.addEventListener('click', () => {
      this.terminateActiveProcess();
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
      // Handle Ctrl+C to cancel running process
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        if (this.activeProcess) {
          e.preventDefault();
          this.terminateActiveProcess();
          return;
        }
      }

      if (e.key === 'Enter') {
        const cmd = this.commandInput.value.trim();
        this.commandInput.value = '';
        if (cmd) {
          if (!this.activeProcess) {
            this.history.push(cmd);
            this.saveHistory();
            this.historyIndex = this.history.length;
          }
          await this.executeCommand(cmd);
        }
      } else if (e.key === 'ArrowUp') {
        if (this.activeProcess) return;
        e.preventDefault();
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.commandInput.value = this.history[this.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (this.activeProcess) return;
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
        preferencesService.set('workbench.bottomPanelHeight', this.defaultHeight);
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

  private parseAnsi(text: string): string {
    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Filter non-SGR sequences
    const cleaned = text.replace(/\x1b\[[0-9;]*[A-HJKSTfimnsu]/g, (match) => {
      if (match.endsWith('m')) return match;
      return '';
    });

    const parts = cleaned.split(/(\x1b\[[0-9;]*m)/g);
    let html = '';
    let activeClasses: string[] = [];

    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('\x1b[')) {
        const codeStr = part.slice(2, -1);
        const codes = codeStr ? codeStr.split(';').map(c => parseInt(c, 10)) : [0];
        for (const code of codes) {
          if (code === 0) {
            activeClasses = [];
          } else if (code === 1) {
            if (!activeClasses.includes('ansi-bold')) activeClasses.push('ansi-bold');
          } else if (code === 2) {
            if (!activeClasses.includes('ansi-dim')) activeClasses.push('ansi-dim');
          } else if (code === 4) {
            if (!activeClasses.includes('ansi-underline')) activeClasses.push('ansi-underline');
          } else if (code >= 30 && code <= 37) {
            const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
            activeClasses = activeClasses.filter(c => !c.startsWith('ansi-'));
            activeClasses.push(`ansi-${colors[code - 30]}`);
          } else if (code >= 90 && code <= 97) {
            const colors = ['bright-black', 'bright-red', 'bright-green', 'bright-yellow', 'bright-blue', 'bright-magenta', 'bright-cyan', 'bright-white'];
            activeClasses = activeClasses.filter(c => !c.startsWith('ansi-'));
            activeClasses.push(`ansi-${colors[code - 90]}`);
          }
        }
      } else {
        const escaped = escapeHtml(part);
        if (activeClasses.length > 0) {
          html += `<span class="${activeClasses.join(' ')}">${escaped}</span>`;
        } else {
          html += escaped;
        }
      }
    }

    return html;
  }

  private appendTerminalLine(text: string, isError: boolean = false, isCommand: boolean = false) {
    const lineEl = document.createElement('div');
    lineEl.className = `terminal-line ${isError ? 'line-error' : ''} ${isCommand ? 'line-command' : ''}`;
    lineEl.textContent = text;
    this.terminalOutputArea.appendChild(lineEl);
    this.lastLineEl = null;
    this.lastLineEnded = true;
    this.trimBufferAndScroll();
  }

  private appendTerminalChunk(rawText: string, isError: boolean = false) {
    if (!rawText) return;

    const html = this.parseAnsi(rawText);
    const lines = html.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineContent = lines[i];
      if (i === 0 && this.lastLineEl && !this.lastLineEnded) {
        this.lastLineEl.innerHTML += lineContent;
      } else {
        const lineEl = document.createElement('div');
        lineEl.className = `terminal-line ${isError ? 'line-error' : ''}`;
        lineEl.innerHTML = lineContent;
        this.terminalOutputArea.appendChild(lineEl);
        this.lastLineEl = lineEl;
      }
      this.lastLineEnded = (i < lines.length - 1);
    }

    this.trimBufferAndScroll();
  }

  private trimBufferAndScroll() {
    while (this.terminalOutputArea.children.length > 5000) {
      this.terminalOutputArea.removeChild(this.terminalOutputArea.firstChild!);
    }
    this.terminalOutputArea.scrollTop = this.terminalOutputArea.scrollHeight;
  }

  private onProcessExit(exitCode: number | string) {
    if (exitCode !== 0 && exitCode !== '0' && exitCode !== undefined) {
      this.appendTerminalLine(`[Process exited with code ${exitCode}]`, true);
    }
    this.activeProcess = null;
    this.lastLineEl = null;
    this.lastLineEnded = true;
    this.updateActiveProcessUI(false);
  }

  async terminateActiveProcess() {
    if (!this.activeProcess) return;
    const procId = this.activeProcess.id;
    try {
      if (isNative()) {
        await window.Neutralino.os.updateSpawnedProcess(procId, 'exit');
      }
    } catch (err) {
      console.warn('Failed to terminate process cleanly:', err);
    }
    this.appendTerminalLine('^C [Process terminated by user]', true);
    this.activeProcess = null;
    this.lastLineEl = null;
    this.lastLineEnded = true;
    this.updateActiveProcessUI(false);
  }

  async executeCommand(commandStr: string) {
    const trimmed = commandStr.trim();
    if (!trimmed) return;

    // If an active process is running, pipe input to its stdin
    if (this.activeProcess) {
      this.appendTerminalLine(commandStr, false, true);
      if (isNative()) {
        try {
          await window.Neutralino.os.updateSpawnedProcess(this.activeProcess.id, 'stdIn', commandStr + '\n');
        } catch (err: any) {
          this.appendTerminalLine(`Failed to send input to process: ${err?.message || err}`, true);
        }
      }
      return;
    }

    // Print command invocation
    this.appendTerminalLine(`PS ${this.currentCwd}> ${commandStr}`, false, true);
    this.lastLineEnded = true;

    // Built-in cls / clear
    if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear') {
      this.terminalOutputArea.innerHTML = '';
      this.lastLineEl = null;
      this.lastLineEnded = true;
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

    // Native execution via spawnProcess for true live streaming
    if (!isNative()) {
      this.appendTerminalLine(`[Web Preview Fallback] Command executed: ${commandStr}`);
      return;
    }

    try {
      const fullCmd = `cmd.exe /c "cd /d "${this.currentCwd}" && ${commandStr}"`;
      const proc = await window.Neutralino.os.spawnProcess(fullCmd);
      this.activeProcess = { id: proc.id, command: commandStr };
      this.updateActiveProcessUI(true);
    } catch (err: any) {
      this.appendTerminalLine(`Error launching process: ${err?.message || err}`, true);
      this.activeProcess = null;
      this.updateActiveProcessUI(false);
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
