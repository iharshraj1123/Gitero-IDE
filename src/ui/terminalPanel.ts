import { isNative } from '../services/neutralino';
import { fsService } from '../services/fs';
import { preferencesService } from '../services/preferences';

interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  history: string[];
  historyIndex: number;
  activeProcess: { id: number; command: string } | null;
  lastLineEl: HTMLElement | null;
  lastLineEnded: boolean;
  outputEl: HTMLElement;
}

export class TerminalPanelComponent {
  private container: HTMLElement;

  // Multi-session state
  private sessions: TerminalSession[] = [];
  private activeSessionId: string = '';
  private sessionCounter: number = 0;
  private processToSession: Map<number, string> = new Map();

  // Panel state
  private activeTab: 'terminal' | 'output' = 'terminal';
  private isOpen: boolean = false;
  private isMaximized: boolean = false;
  private defaultHeight: number = 220;

  // DOM refs
  private terminalTabBtn!: HTMLElement;
  private outputTabBtn!: HTMLElement;
  private sessionBar!: HTMLElement;
  private terminalView!: HTMLElement;
  private outputView!: HTMLElement;
  private terminalBody!: HTMLElement;
  private outputLogsArea!: HTMLElement;
  private promptLabel!: HTMLElement;
  private commandInput!: HTMLInputElement;
  private stopBtn!: HTMLButtonElement;

  // Floating menus
  private activeDropdown: HTMLElement | null = null;
  private activeContextMenu: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.defaultHeight = preferencesService.get('workbench.bottomPanelHeight') || 220;
    this.applyTypography();
    preferencesService.subscribe('terminal.fontSize', () => this.applyTypography());
    preferencesService.subscribe('terminal.fontFamily', () => this.applyTypography());
    this.build();
    this.setupStaticListeners();
    this.setupResizer();
    this.setupNativeProcessEvents();
    // Create the first terminal session
    this.addSession(true);
  }

  // -------------------------------------------------------------------------
  // Typography
  // -------------------------------------------------------------------------

  private applyTypography() {
    const size = preferencesService.get('terminal.fontSize') || 13;
    const font = preferencesService.get('terminal.fontFamily') || '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace';
    this.container.style.setProperty('--terminal-font-size', `${size}px`);
    this.container.style.setProperty('--terminal-font-family', font);
  }

  // -------------------------------------------------------------------------
  // History (global, shared across sessions for convenience)
  // -------------------------------------------------------------------------

  private loadGlobalHistory(): string[] {
    try {
      const raw = localStorage.getItem('gitero_terminal_history');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {
      console.warn('Failed to load terminal history', e);
    }
    return [];
  }

  private saveGlobalHistory(history: string[]) {
    try {
      localStorage.setItem('gitero_terminal_history', JSON.stringify(history.slice(-100)));
    } catch (e) {
      console.warn('Failed to persist terminal history', e);
    }
  }

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  private getWorkspaceRoot(): string {
    return fsService.getWorkspace() || '.';
  }

  /** Public: add a new terminal session (called from + button or command palette). */
  addTerminal() {
    this.addSession(false);
    if (!this.isOpen) this.toggle(true);
    setTimeout(() => this.commandInput.focus(), 50);
  }

  private addSession(isFirst = false): TerminalSession {
    this.sessionCounter++;
    const id = `term-${this.sessionCounter}`;
    const name = `Terminal ${this.sessionCounter}`;
    // New terminals always start in workspace root
    const cwd = this.getWorkspaceRoot();
    const history = isFirst ? this.loadGlobalHistory() : [];

    const outputEl = document.createElement('div');
    outputEl.className = 'terminal-output-area';
    this.setupOutputContextMenu(outputEl);

    const session: TerminalSession = {
      id,
      name,
      cwd,
      history,
      historyIndex: history.length,
      activeProcess: null,
      lastLineEl: null,
      lastLineEnded: true,
      outputEl,
    };

    this.sessions.push(session);
    this.renderSessionBar();
    this.activateSession(id);

    if (isFirst) {
      this.printWelcome(session);
    } else {
      this.appendToSession(session, `Gitero IDE Integrated Terminal — ${cwd}`);
    }

    return session;
  }

  private activateSession(id: string) {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    this.activeSessionId = id;

    // Swap the output element
    this.terminalBody.innerHTML = '';
    this.terminalBody.appendChild(session.outputEl);

    this.updatePrompt();
    this.updateActiveProcessUI(!!session.activeProcess);
    this.renderSessionBar();

    setTimeout(() => {
      session.outputEl.scrollTop = session.outputEl.scrollHeight;
    }, 0);
  }

  private getActiveSession(): TerminalSession | null {
    return this.sessions.find(s => s.id === this.activeSessionId) || null;
  }

  private closeSession(id: string) {
    if (this.sessions.length <= 1) return; // cannot close the last session
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx === -1) return;

    const session = this.sessions[idx];
    // Clean up process if running
    if (session.activeProcess) {
      if (isNative()) {
        window.Neutralino.os.updateSpawnedProcess(session.activeProcess.id, 'exit').catch(() => {});
      }
      this.processToSession.delete(session.activeProcess.id);
    }

    this.sessions.splice(idx, 1);

    // Activate the adjacent session
    const newActiveIdx = Math.min(idx, this.sessions.length - 1);
    this.activateSession(this.sessions[newActiveIdx].id);
  }

  // -------------------------------------------------------------------------
  // Session Bar (renders all session chips + + button)
  // -------------------------------------------------------------------------

  private renderSessionBar() {
    this.sessionBar.innerHTML = '';

    for (const session of this.sessions) {
      const isActive = session.id === this.activeSessionId;
      const chip = document.createElement('div');
      chip.className = `terminal-session-tab${isActive ? ' active' : ''}`;
      chip.dataset.sessionId = session.id;

      // Name span — click to activate
      const nameSpan = document.createElement('span');
      nameSpan.className = 'terminal-session-tab-name';
      nameSpan.textContent = session.name;
      nameSpan.addEventListener('click', () => {
        this.activateSession(session.id);
        this.commandInput.focus();
      });

      // 3-dot options button
      const menuBtn = document.createElement('button');
      menuBtn.className = 'terminal-session-menu-btn';
      menuBtn.title = 'Terminal Options';
      menuBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`;
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSessionMenu(menuBtn, session);
      });

      chip.appendChild(nameSpan);
      chip.appendChild(menuBtn);
      this.sessionBar.appendChild(chip);
    }

    // + New Terminal button
    const addBtn = document.createElement('button');
    addBtn.className = 'terminal-session-add';
    addBtn.title = 'New Terminal';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => {
      this.addSession(false);
      this.commandInput.focus();
    });
    this.sessionBar.appendChild(addBtn);
  }

  // -------------------------------------------------------------------------
  // 3-dot Session Menu
  // -------------------------------------------------------------------------

  private showSessionMenu(anchorEl: HTMLElement, session: TerminalSession) {
    this.closeActiveDropdown();

    const menu = document.createElement('div');
    menu.className = 'terminal-session-dropdown';

    const items: Array<{ label?: string; action?: () => void; danger?: boolean; divider?: boolean }> = [
      { label: 'Rename', action: () => this.renameSession(session) },
      { label: 'Clear', action: () => this.clearSession(session) },
      { divider: true },
      { label: 'Close', action: () => this.closeSession(session.id), danger: true },
    ];

    for (const item of items) {
      if (item.divider) {
        const hr = document.createElement('div');
        hr.className = 'terminal-session-dropdown-divider';
        menu.appendChild(hr);
        continue;
      }
      const btn = document.createElement('button');
      btn.className = `terminal-session-dropdown-item${item.danger ? ' danger' : ''}`;
      btn.textContent = item.label!;
      btn.addEventListener('click', () => {
        this.closeActiveDropdown();
        item.action!();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    this.activeDropdown = menu;

    // Position below anchor
    const rect = anchorEl.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 2}px`;

    // Clamp to viewport
    requestAnimationFrame(() => {
      const mr = menu.getBoundingClientRect();
      if (mr.right > window.innerWidth) {
        menu.style.left = `${rect.right - mr.width}px`;
      }
      if (mr.bottom > window.innerHeight) {
        menu.style.top = `${rect.top - mr.height - 2}px`;
      }
    });

    // Dismiss on outside click
    const dismiss = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== anchorEl) {
        this.closeActiveDropdown();
        document.removeEventListener('mousedown', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss, true), 0);
  }

  private closeActiveDropdown() {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
  }

  // -------------------------------------------------------------------------
  // Session Actions: Rename, Clear
  // -------------------------------------------------------------------------

  private renameSession(session: TerminalSession) {
    // Find the name span for this session chip and replace with an inline input
    const chip = this.sessionBar.querySelector(`[data-session-id="${session.id}"] .terminal-session-tab-name`);
    if (!chip) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-session-rename-input';
    input.value = session.name;
    input.spellcheck = false;
    chip.replaceWith(input);
    input.select();
    input.focus();

    const commit = () => {
      const newName = input.value.trim() || session.name;
      session.name = newName;
      this.renderSessionBar();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { this.renderSessionBar(); }
    });
    input.addEventListener('blur', () => commit());
  }

  private clearSession(session: TerminalSession) {
    session.outputEl.innerHTML = '';
    session.lastLineEl = null;
    session.lastLineEnded = true;
  }

  // -------------------------------------------------------------------------
  // Right-click Context Menu (Copy / Paste)
  // -------------------------------------------------------------------------

  private setupOutputContextMenu(outputEl: HTMLElement) {
    outputEl.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      this.closeActiveContextMenu();

      const selectedText = window.getSelection()?.toString() || '';
      const hasSelection = selectedText.trim().length > 0;

      const menu = document.createElement('div');
      menu.className = 'terminal-context-menu';

      const makeItem = (label: string, action: () => void) => {
        const btn = document.createElement('button');
        btn.className = 'terminal-context-menu-item';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          this.closeActiveContextMenu();
          action();
        });
        menu.appendChild(btn);
      };

      if (hasSelection) {
        makeItem('Copy', () => {
          navigator.clipboard.writeText(selectedText).catch(() => {
            try { document.execCommand('copy'); } catch {}
          });
        });
      } else {
        makeItem('Paste', async () => {
          try {
            const text = await navigator.clipboard.readText();
            this.commandInput.value += text;
          } catch {
            // clipboard access denied — focus input so user can paste manually with Ctrl+V
          }
          this.commandInput.focus();
        });
      }

      document.body.appendChild(menu);
      this.activeContextMenu = menu;

      // Position at cursor, clamped to viewport
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      requestAnimationFrame(() => {
        const mr = menu.getBoundingClientRect();
        if (mr.right > window.innerWidth) menu.style.left = `${e.clientX - mr.width}px`;
        if (mr.bottom > window.innerHeight) menu.style.top = `${e.clientY - mr.height}px`;
      });

      const dismiss = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          this.closeActiveContextMenu();
          document.removeEventListener('mousedown', dismiss, true);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', dismiss, true), 0);
    });
  }

  private closeActiveContextMenu() {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  // -------------------------------------------------------------------------
  // HTML Build
  // -------------------------------------------------------------------------

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

      <!-- Terminal Session Sub-Tab Bar -->
      <div class="terminal-session-bar" id="terminal-session-bar"></div>

      <div class="bottom-panel-content">
        <!-- Terminal View -->
        <div class="terminal-view-container" id="terminal-view">
          <div class="terminal-body" id="terminal-body"></div>
          <div class="terminal-input-row" id="terminal-input-row">
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
    this.sessionBar = this.container.querySelector('#terminal-session-bar') as HTMLElement;
    this.terminalView = this.container.querySelector('#terminal-view') as HTMLElement;
    this.outputView = this.container.querySelector('#output-view') as HTMLElement;
    this.terminalBody = this.container.querySelector('#terminal-body') as HTMLElement;
    this.outputLogsArea = this.container.querySelector('#output-logs-area') as HTMLElement;
    this.promptLabel = this.container.querySelector('#terminal-prompt-label') as HTMLElement;
    this.commandInput = this.container.querySelector('#terminal-cmd-input') as HTMLInputElement;
    this.stopBtn = this.container.querySelector('#btn-panel-stop') as HTMLButtonElement;
  }

  // -------------------------------------------------------------------------
  // Static Listeners (panel-level, not session-specific)
  // -------------------------------------------------------------------------

  private setupStaticListeners() {
    this.terminalTabBtn.addEventListener('click', () => this.switchTab('terminal'));
    this.outputTabBtn.addEventListener('click', () => this.switchTab('output'));

    this.container.querySelector('#btn-panel-clear')?.addEventListener('click', () => {
      if (this.activeTab === 'terminal') {
        const session = this.getActiveSession();
        if (session) this.clearSession(session);
      } else {
        this.outputLogsArea.innerHTML = '';
      }
    });

    this.stopBtn.addEventListener('click', () => this.terminateActiveProcess());

    this.container.querySelector('#btn-panel-close')?.addEventListener('click', () => this.toggle(false));

    this.container.querySelector('#btn-panel-max')?.addEventListener('click', () => {
      this.isMaximized = !this.isMaximized;
      this.container.style.height = this.isMaximized ? '75%' : `${this.defaultHeight}px`;
    });

    // Click on the input row to focus the input (NOT on the whole view — keeps output selectable)
    const inputRow = this.container.querySelector('#terminal-input-row') as HTMLElement;
    inputRow?.addEventListener('click', (e) => {
      // Only focus if the click was directly on the row or prompt, not a child input
      if ((e.target as HTMLElement) !== this.commandInput) {
        this.commandInput.focus();
      }
    });

    // Command input keydown
    this.commandInput.addEventListener('keydown', async (e) => {
      // Ctrl+C → terminate process
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        const session = this.getActiveSession();
        if (session?.activeProcess) {
          e.preventDefault();
          this.terminateActiveProcess();
          return;
        }
      }

      if (e.key === 'Enter') {
        const session = this.getActiveSession();
        if (!session) return;
        const cmd = this.commandInput.value.trim();
        this.commandInput.value = '';
        if (cmd) {
          if (!session.activeProcess) {
            session.history.push(cmd);
            this.saveGlobalHistory(session.history);
            session.historyIndex = session.history.length;
          }
          await this.executeCommand(cmd);
        }
      } else if (e.key === 'ArrowUp') {
        const session = this.getActiveSession();
        if (!session || session.activeProcess) return;
        e.preventDefault();
        if (session.historyIndex > 0) {
          session.historyIndex--;
          this.commandInput.value = session.history[session.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        const session = this.getActiveSession();
        if (!session || session.activeProcess) return;
        e.preventDefault();
        if (session.historyIndex < session.history.length - 1) {
          session.historyIndex++;
          this.commandInput.value = session.history[session.historyIndex] || '';
        } else {
          session.historyIndex = session.history.length;
          this.commandInput.value = '';
        }
      }
    });

    // Dismiss floating menus on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeActiveDropdown();
        this.closeActiveContextMenu();
      }
    });
  }

  // -------------------------------------------------------------------------
  // Panel Resizer
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Native Process Events
  // -------------------------------------------------------------------------

  private setupNativeProcessEvents() {
    if (typeof window !== 'undefined' && window.Neutralino?.events) {
      window.Neutralino.events.on('spawnedProcess', (evt: any) => {
        const detail = evt?.detail;
        if (!detail) return;

        // Route output to the session that owns this process ID
        const sessionId = this.processToSession.get(detail.id);
        const session = sessionId ? this.sessions.find(s => s.id === sessionId) : null;
        if (!session) return;

        if (detail.action === 'stdOut') {
          this.appendChunkToSession(session, detail.data, false);
        } else if (detail.action === 'stdErr') {
          this.appendChunkToSession(session, detail.data, true);
        } else if (detail.action === 'exit') {
          this.onProcessExit(session, detail.data);
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // Tab Switching (TERMINAL / OUTPUT)
  // -------------------------------------------------------------------------

  private switchTab(tab: 'terminal' | 'output') {
    this.activeTab = tab;
    this.terminalTabBtn.classList.toggle('active', tab === 'terminal');
    this.outputTabBtn.classList.toggle('active', tab === 'output');
    this.terminalView.style.display = tab === 'terminal' ? 'flex' : 'none';
    this.outputView.style.display = tab === 'output' ? 'flex' : 'none';
    this.sessionBar.style.display = tab === 'terminal' ? 'flex' : 'none';
    if (tab === 'terminal') {
      this.commandInput.focus();
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

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

  /** Update the active terminal session's working directory (called on workspace switch). */
  setCwd(newCwd: string) {
    const session = this.getActiveSession();
    if (session) {
      session.cwd = newCwd;
      this.updatePrompt();
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

  // -------------------------------------------------------------------------
  // Prompt
  // -------------------------------------------------------------------------

  private updatePrompt() {
    const session = this.getActiveSession();
    if (!session) return;
    if (session.activeProcess) {
      this.promptLabel.innerHTML = `Running <span class="terminal-badge-running"></span> &gt; `;
      return;
    }
    const cwd = session.cwd || this.getWorkspaceRoot() || 'C:\\';
    const shortPath = cwd.length > 35 ? '...' + cwd.slice(-32) : cwd;
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

  // -------------------------------------------------------------------------
  // Output helpers
  // -------------------------------------------------------------------------

  private printWelcome(session: TerminalSession) {
    this.appendToSession(session, 'Gitero IDE Integrated Terminal [Live Streaming Execution]');
    this.appendToSession(session, 'Real-time background tasks supported. Use Ctrl+C or the Stop button to terminate running commands.\n');
  }

  private appendToSession(session: TerminalSession, text: string, isError = false, isCommand = false) {
    const lineEl = document.createElement('div');
    lineEl.className = `terminal-line${isError ? ' line-error' : ''}${isCommand ? ' line-command' : ''}`;
    lineEl.textContent = text;
    session.outputEl.appendChild(lineEl);
    session.lastLineEl = null;
    session.lastLineEnded = true;
    this.trimAndScrollSession(session);
  }

  private appendChunkToSession(session: TerminalSession, rawText: string, isError = false) {
    if (!rawText) return;
    const html = this.parseAnsi(rawText);
    const lines = html.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const lineContent = lines[i];
      if (i === 0 && session.lastLineEl && !session.lastLineEnded) {
        session.lastLineEl.innerHTML += lineContent;
      } else {
        const lineEl = document.createElement('div');
        lineEl.className = `terminal-line${isError ? ' line-error' : ''}`;
        lineEl.innerHTML = lineContent;
        session.outputEl.appendChild(lineEl);
        session.lastLineEl = lineEl;
      }
      session.lastLineEnded = (i < lines.length - 1);
    }

    this.trimAndScrollSession(session);
  }

  private trimAndScrollSession(session: TerminalSession) {
    while (session.outputEl.children.length > 5000) {
      session.outputEl.removeChild(session.outputEl.firstChild!);
    }
    // Only auto-scroll if this is the active session (already in view)
    if (session.id === this.activeSessionId) {
      session.outputEl.scrollTop = session.outputEl.scrollHeight;
    }
  }

  // -------------------------------------------------------------------------
  // ANSI Parser
  // -------------------------------------------------------------------------

  private parseAnsi(text: string): string {
    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Strip non-SGR escape sequences
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
        html += activeClasses.length > 0
          ? `<span class="${activeClasses.join(' ')}">${escaped}</span>`
          : escaped;
      }
    }

    return html;
  }

  // -------------------------------------------------------------------------
  // Process Management
  // -------------------------------------------------------------------------

  async terminateActiveProcess() {
    const session = this.getActiveSession();
    if (!session?.activeProcess) return;
    const procId = session.activeProcess.id;
    try {
      if (isNative()) {
        await window.Neutralino.os.updateSpawnedProcess(procId, 'exit');
      }
    } catch (err) {
      console.warn('Failed to terminate process cleanly:', err);
    }
    this.appendToSession(session, '^C [Process terminated by user]', true);
    this.processToSession.delete(procId);
    session.activeProcess = null;
    session.lastLineEl = null;
    session.lastLineEnded = true;
    this.updateActiveProcessUI(false);
  }

  private onProcessExit(session: TerminalSession, exitCode: number | string) {
    if (exitCode !== 0 && exitCode !== '0' && exitCode !== undefined) {
      this.appendToSession(session, `[Process exited with code ${exitCode}]`, true);
    }
    if (session.activeProcess) {
      this.processToSession.delete(session.activeProcess.id);
    }
    session.activeProcess = null;
    session.lastLineEl = null;
    session.lastLineEnded = true;
    // Only update UI if this is the currently visible session
    if (session.id === this.activeSessionId) {
      this.updateActiveProcessUI(false);
    }
  }

  async executeCommand(commandStr: string) {
    const session = this.getActiveSession();
    if (!session) return;
    const trimmed = commandStr.trim();
    if (!trimmed) return;

    // Pipe stdin to running process
    if (session.activeProcess) {
      this.appendToSession(session, commandStr, false, true);
      if (isNative()) {
        try {
          await window.Neutralino.os.updateSpawnedProcess(session.activeProcess.id, 'stdIn', commandStr + '\n');
        } catch (err: any) {
          this.appendToSession(session, `Failed to send input to process: ${err?.message || err}`, true);
        }
      }
      return;
    }

    // Print the command invocation line
    this.appendToSession(session, `PS ${session.cwd}> ${commandStr}`, false, true);
    session.lastLineEnded = true;

    // Built-in: cls / clear
    if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear') {
      this.clearSession(session);
      return;
    }

    // Built-in: cd
    if (/^cd\s*/i.test(trimmed)) {
      const targetDir = trimmed.replace(/^cd\s*/i, '').trim().replace(/^"/, '').replace(/"$/, '');
      if (!targetDir || targetDir === '.') return;
      if (isNative()) {
        try {
          const testCmd = `cd /d "${session.cwd}" && cd "${targetDir}" && cd`;
          const res = await window.Neutralino.os.execCommand(testCmd);
          if (res.exitCode === 0 && res.stdOut) {
            session.cwd = res.stdOut.trim();
            this.updatePrompt();
          } else {
            this.appendToSession(session, `Cannot find path '${targetDir}' because it does not exist.`, true);
          }
        } catch (e: any) {
          this.appendToSession(session, e.message || String(e), true);
        }
      } else {
        session.cwd = targetDir;
        this.updatePrompt();
      }
      return;
    }

    // Web fallback
    if (!isNative()) {
      this.appendToSession(session, `[Web Preview Fallback] Command executed: ${commandStr}`);
      return;
    }

    // Spawn process for live streaming
    try {
      const fullCmd = `cmd.exe /c "cd /d "${session.cwd}" && ${commandStr}"`;
      const proc = await window.Neutralino.os.spawnProcess(fullCmd);
      session.activeProcess = { id: proc.id, command: commandStr };
      this.processToSession.set(proc.id, session.id);
      this.updateActiveProcessUI(true);
    } catch (err: any) {
      this.appendToSession(session, `Error launching process: ${err?.message || err}`, true);
      session.activeProcess = null;
      this.updateActiveProcessUI(false);
    }
  }
}
