import { gitService, GitFileChange } from '../services/git';
import { getFileIconSvg } from './icons';

export class DiffModalComponent {
  private overlay: HTMLElement | null = null;
  private currentChange: GitFileChange | null = null;
  private isStaged: boolean = false;
  private activeRequestId: number = 0;

  constructor() {
    this.setupGlobalListeners();
  }

  private setupGlobalListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay) {
        this.close();
      }
    });
  }

  public async open(change: GitFileChange, isStaged: boolean = false) {
    this.close();
    const reqId = ++this.activeRequestId;
    this.currentChange = change;
    this.isStaged = isStaged;

    const fileName = change.relativePath.split('/').pop() || change.relativePath;

    this.overlay = document.createElement('div');
    this.overlay.className = 'diff-modal-overlay';

    this.overlay.innerHTML = `
      <div class="diff-modal-dialog">
        <div class="diff-modal-header">
          <div class="diff-modal-title">
            <span class="diff-file-icon">${getFileIconSvg(fileName, false)}</span>
            <span class="diff-file-path">${this.escapeHtml(change.relativePath)}</span>
            <span class="git-status-code status-${change.status.toLowerCase()}">${change.status}</span>
            <span class="diff-stage-tag">${isStaged ? 'STAGED' : 'WORKING TREE'}</span>
          </div>
          <div class="diff-modal-actions">
            <button class="btn btn-secondary btn-sm" id="btn-diff-toggle-stage">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${isStaged 
                  ? '<line x1="5" y1="12" x2="19" y2="12"/>' 
                  : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
              </svg>
              <span>${isStaged ? 'Unstage Changes' : 'Stage Changes'}</span>
            </button>
            <button class="diff-modal-close-btn" id="btn-diff-close" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="diff-modal-body">
          <div class="diff-viewer-table" id="diff-viewer-table">
            <div class="diff-empty-msg">Loading diff...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Setup action listeners
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    this.overlay.querySelector('#btn-diff-close')?.addEventListener('click', () => {
      this.close();
    });

    const toggleStageBtn = this.overlay.querySelector('#btn-diff-toggle-stage') as HTMLButtonElement;
    toggleStageBtn?.addEventListener('click', async () => {
      if (!this.currentChange) return;
      toggleStageBtn.disabled = true;
      if (this.isStaged) {
        await gitService.unstageFile(this.currentChange.relativePath);
        this.isStaged = false;
        toggleStageBtn.querySelector('span')!.textContent = 'Stage Changes';
        const tag = this.overlay?.querySelector('.diff-stage-tag');
        if (tag) tag.textContent = 'WORKING TREE';
      } else {
        await gitService.stageFile(this.currentChange.relativePath);
        this.isStaged = true;
        toggleStageBtn.querySelector('span')!.textContent = 'Unstage Changes';
        const tag = this.overlay?.querySelector('.diff-stage-tag');
        if (tag) tag.textContent = 'STAGED';
      }
      toggleStageBtn.disabled = false;
      // Refresh diff view
      const refreshed = await gitService.getFileDiff(this.currentChange.relativePath, this.isStaged);
      if (this.activeRequestId === reqId) {
        this.renderDiffContent(refreshed.diff);
      }
    });

    const diffData = await gitService.getFileDiff(change.relativePath, isStaged);
    if (this.activeRequestId === reqId) {
      this.renderDiffContent(diffData.diff);
    }
  }

  /**
   * Open diff modal specifically for a historical commit's changed file
   */
  public async openCommitDiff(commitHash: string, filePath: string, parentHash?: string, status: string = 'M') {
    this.close();
    const reqId = ++this.activeRequestId;
    this.currentChange = null;
    this.isStaged = false;

    const fileName = filePath.split('/').pop() || filePath;
    const shortHash = commitHash.slice(0, 7);

    this.overlay = document.createElement('div');
    this.overlay.className = 'diff-modal-overlay';

    this.overlay.innerHTML = `
      <div class="diff-modal-dialog">
        <div class="diff-modal-header">
          <div class="diff-modal-title">
            <span class="diff-file-icon">${getFileIconSvg(fileName, false)}</span>
            <span class="diff-file-path">${this.escapeHtml(filePath)}</span>
            <span class="git-status-code status-${status.toLowerCase()}">${this.escapeHtml(status)}</span>
            <span class="diff-stage-tag commit-tag">COMMIT ${this.escapeHtml(shortHash)}</span>
          </div>
          <div class="diff-modal-actions">
            <button class="diff-modal-close-btn" id="btn-diff-close" aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="diff-modal-body">
          <div class="diff-viewer-table" id="diff-viewer-table">
            <div class="diff-empty-msg">Loading diff for commit ${this.escapeHtml(shortHash)}...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Setup action listeners
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    this.overlay.querySelector('#btn-diff-close')?.addEventListener('click', () => {
      this.close();
    });

    const diffText = await gitService.getCommitFileDiff(commitHash, filePath, parentHash);
    if (this.activeRequestId === reqId) {
      this.renderDiffContent(diffText);
    }
  }

  private renderDiffContent(rawDiff: string) {
    if (!this.overlay) return;
    const tableEl = this.overlay.querySelector('#diff-viewer-table') as HTMLElement;
    if (!tableEl) return;

    tableEl.innerHTML = '';
    const lines = rawDiff.split(/\r?\n/);

    if (!rawDiff || lines.length === 0 || (lines.length === 1 && !lines[0]) || rawDiff === 'No differences detected') {
      tableEl.innerHTML = `<div class="diff-empty-msg">No differences detected.</div>`;
      return;
    }

    if (rawDiff === 'No textual differences detected.' || rawDiff === 'No diff available.') {
      tableEl.innerHTML = `<div class="diff-empty-msg">${this.escapeHtml(rawDiff)}</div>`;
      return;
    }

    if (rawDiff.includes('Binary files ') && !rawDiff.includes('@@')) {
      tableEl.innerHTML = `<div class="diff-empty-msg">Binary file changed (no textual diff available).</div>`;
      return;
    }

    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      // Check for file header lines (diff --git, index, mode changes)
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('old mode') ||
        line.startsWith('new mode') ||
        line.startsWith('deleted file mode') ||
        line.startsWith('new file mode') ||
        line.startsWith('similarity index') ||
        line.startsWith('rename from') ||
        line.startsWith('rename to')
      ) {
        continue;
      }
      if (line.startsWith('---') || line.startsWith('+++')) {
        const headerRow = document.createElement('div');
        headerRow.className = 'diff-row diff-meta-header';
        headerRow.textContent = line;
        tableEl.appendChild(headerRow);
        continue;
      }

      // Check for hunk header @@ -old,len +new,len @@
      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
      if (hunkMatch) {
        oldLine = parseInt(hunkMatch[1], 10);
        newLine = parseInt(hunkMatch[2], 10);

        const hunkRow = document.createElement('div');
        hunkRow.className = 'diff-row diff-hunk-row';
        hunkRow.innerHTML = `
          <span class="diff-line-col diff-line-hunk-spacer">...</span>
          <span class="diff-line-col diff-line-hunk-spacer">...</span>
          <span class="diff-content-col diff-hunk-text">${this.escapeHtml(line)}</span>
        `;
        tableEl.appendChild(hunkRow);
        continue;
      }

      const row = document.createElement('div');

      if (line.startsWith('+')) {
        row.className = 'diff-row diff-row-added';
        row.innerHTML = `
          <span class="diff-line-col diff-line-old"></span>
          <span class="diff-line-col diff-line-new">${newLine}</span>
          <span class="diff-prefix-col">+</span>
          <span class="diff-content-col">${this.escapeHtml(line.substring(1))}</span>
        `;
        newLine++;
      } else if (line.startsWith('-')) {
        row.className = 'diff-row diff-row-deleted';
        row.innerHTML = `
          <span class="diff-line-col diff-line-old">${oldLine}</span>
          <span class="diff-line-col diff-line-new"></span>
          <span class="diff-prefix-col">-</span>
          <span class="diff-content-col">${this.escapeHtml(line.substring(1))}</span>
        `;
        oldLine++;
      } else {
        // Context line
        row.className = 'diff-row diff-row-context';
        row.innerHTML = `
          <span class="diff-line-col diff-line-old">${oldLine > 0 ? oldLine : ''}</span>
          <span class="diff-line-col diff-line-new">${newLine > 0 ? newLine : ''}</span>
          <span class="diff-prefix-col"> </span>
          <span class="diff-content-col">${this.escapeHtml(line.startsWith(' ') ? line.substring(1) : line)}</span>
        `;
        if (oldLine > 0) oldLine++;
        if (newLine > 0) newLine++;
      }

      tableEl.appendChild(row);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public close() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.currentChange = null;
    }
  }
}

export const diffModal = new DiffModalComponent();

