/**
 * Error Details Modal Component
 * Displays actionable, detailed diagnostic reports for failed commands and background services.
 * Features copyable raw terminal outputs, exit codes, and diagnostic hints.
 */

export interface ErrorModalOptions {
  title: string;
  subtitle?: string;
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  details?: string;
  hints?: string[];
}

export class ErrorModalComponent {
  private container: HTMLElement;
  private isOpen: boolean = false;
  private currentOptions: ErrorModalOptions | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'error-details-modal-overlay';
    this.container.style.display = 'none';
    this.build();
    if (typeof document !== 'undefined') {
      if (document.body) {
        document.body.appendChild(this.container);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(this.container);
        });
      }
    }
  }

  private build() {
    this.container.innerHTML = `
      <div class="error-details-modal-dialog">
        <div class="error-details-modal-header">
          <div class="error-details-modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f85149" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span id="error-modal-title-text">Execution Error</span>
          </div>
          <button class="error-details-modal-close" id="btn-error-modal-close" aria-label="Close" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div class="error-details-modal-body">
          <div class="error-details-subtitle" id="error-modal-subtitle"></div>

          <div class="error-details-field" id="error-modal-command-row">
            <div class="error-details-label">Command:</div>
            <div class="error-details-code-row">
              <code class="error-details-command" id="error-modal-command"></code>
              <button class="error-details-copy-btn" id="btn-error-copy-cmd" title="Copy Command">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div class="error-details-field" id="error-modal-exit-row">
            <div class="error-details-label">Exit Code:</div>
            <div class="error-details-exit-code" id="error-modal-exit-code"></div>
          </div>

          <div class="error-details-field" id="error-modal-hints-row" style="display: none;">
            <div class="error-details-label">Troubleshooting Suggestions:</div>
            <ul class="error-details-hints-list" id="error-modal-hints-list"></ul>
          </div>

          <div class="error-details-field">
            <div class="error-details-label">Output & Diagnostic Logs:</div>
            <pre class="error-details-log" id="error-modal-log"></pre>
          </div>
        </div>

        <div class="error-details-modal-footer">
          <button class="error-details-footer-btn secondary" id="btn-error-modal-close-footer">Close</button>
          <button class="error-details-footer-btn primary" id="btn-error-copy-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span>Copy Full Report</span>
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-error-modal-close')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btn-error-modal-close-footer')?.addEventListener('click', () => this.close());

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.container.querySelector('#btn-error-copy-cmd')?.addEventListener('click', () => {
      if (this.currentOptions?.command) {
        navigator.clipboard.writeText(this.currentOptions.command);
        const btn = this.container.querySelector('#btn-error-copy-cmd span') as HTMLElement;
        if (btn) {
          btn.textContent = 'Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }
      }
    });

    this.container.querySelector('#btn-error-copy-all')?.addEventListener('click', () => {
      if (this.currentOptions) {
        const report = this.formatFullReport(this.currentOptions);
        navigator.clipboard.writeText(report);
        const btn = this.container.querySelector('#btn-error-copy-all span') as HTMLElement;
        if (btn) {
          btn.textContent = 'Report Copied';
          setTimeout(() => { btn.textContent = 'Copy Full Report'; }, 1800);
        }
      }
    });
  }

  open(options: ErrorModalOptions) {
    if (typeof document !== 'undefined' && document.body && !this.container.parentElement) {
      document.body.appendChild(this.container);
    }
    this.currentOptions = options;
    this.isOpen = true;

    const titleEl = this.container.querySelector('#error-modal-title-text') as HTMLElement;
    if (titleEl) titleEl.textContent = options.title || 'Execution Error';

    const subEl = this.container.querySelector('#error-modal-subtitle') as HTMLElement;
    if (subEl) {
      if (options.subtitle) {
        subEl.textContent = options.subtitle;
        subEl.style.display = 'block';
      } else {
        subEl.style.display = 'none';
      }
    }

    const cmdRow = this.container.querySelector('#error-modal-command-row') as HTMLElement;
    const cmdEl = this.container.querySelector('#error-modal-command') as HTMLElement;
    if (cmdRow && cmdEl) {
      if (options.command) {
        cmdEl.textContent = options.command;
        cmdRow.style.display = 'flex';
      } else {
        cmdRow.style.display = 'none';
      }
    }

    const exitRow = this.container.querySelector('#error-modal-exit-row') as HTMLElement;
    const exitEl = this.container.querySelector('#error-modal-exit-code') as HTMLElement;
    if (exitRow && exitEl) {
      if (options.exitCode !== undefined) {
        exitEl.textContent = String(options.exitCode);
        exitRow.style.display = 'flex';
      } else {
        exitRow.style.display = 'none';
      }
    }

    const hintsRow = this.container.querySelector('#error-modal-hints-row') as HTMLElement;
    const hintsList = this.container.querySelector('#error-modal-hints-list') as HTMLElement;
    if (hintsRow && hintsList) {
      if (options.hints && options.hints.length > 0) {
        hintsList.innerHTML = options.hints.map((h) => `<li>${h}</li>`).join('');
        hintsRow.style.display = 'block';
      } else {
        hintsRow.style.display = 'none';
      }
    }

    const logEl = this.container.querySelector('#error-modal-log') as HTMLElement;
    if (logEl) {
      const logs = [
        options.stderr ? `[STDERR]\n${options.stderr.trim()}` : '',
        options.stdout ? `[STDOUT]\n${options.stdout.trim()}` : '',
        options.details ? `[DETAILS]\n${options.details.trim()}` : ''
      ].filter(Boolean).join('\n\n');

      logEl.textContent = logs || 'No standard output or standard error was emitted by the process.';
    }

    this.container.style.display = 'flex';
  }

  close() {
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  formatFullReport(opts: ErrorModalOptions): string {
    const lines = [
      `=== ${opts.title || 'Execution Error'} ===`,
      opts.subtitle ? `Description: ${opts.subtitle}` : '',
      opts.command ? `Command: ${opts.command}` : '',
      opts.exitCode !== undefined ? `Exit Code: ${opts.exitCode}` : '',
      ''
    ];

    if (opts.hints && opts.hints.length > 0) {
      lines.push('Suggestions:');
      opts.hints.forEach((h) => lines.push(` - ${h}`));
      lines.push('');
    }

    if (opts.stderr) {
      lines.push('--- Standard Error ---');
      lines.push(opts.stderr.trim());
      lines.push('');
    }

    if (opts.stdout) {
      lines.push('--- Standard Output ---');
      lines.push(opts.stdout.trim());
      lines.push('');
    }

    if (opts.details) {
      lines.push('--- Additional Details ---');
      lines.push(opts.details.trim());
      lines.push('');
    }

    return lines.filter((l) => l !== undefined).join('\n');
  }
}

export const errorModal = new ErrorModalComponent();
