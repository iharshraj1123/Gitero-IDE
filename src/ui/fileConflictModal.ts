/**
 * File Conflict Resolution Modal Component
 * Renders a side-by-side / unified diff comparing external disk modifications
 * against local unsaved editor changes, allowing developers to safely resolve conflicts.
 */

import { EditorTab } from '../state/editorState';
import { getFileIconSvg } from './icons';

export interface FileConflictOptions {
  tab: EditorTab;
  diskContent: string;
  localContent: string;
  onOverwrite: () => Promise<void> | void;
  onRevert: () => Promise<void> | void;
  onKeepBoth?: () => void;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'deleted';
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

function computeLineDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split(/\r?\n/);
  const linesB = textB.split(/\r?\n/);
  const n = linesA.length;
  const m = linesB.length;

  if (textA === textB) return [];

  // Strip common prefix
  let prefixLen = 0;
  while (prefixLen < n && prefixLen < m && linesA[prefixLen] === linesB[prefixLen]) {
    prefixLen++;
  }

  // Strip common suffix
  let suffixLen = 0;
  while (
    suffixLen < (n - prefixLen) &&
    suffixLen < (m - prefixLen) &&
    linesA[n - 1 - suffixLen] === linesB[m - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const result: DiffLine[] = [];
  for (let k = 0; k < prefixLen; k++) {
    result.push({ type: 'unchanged', text: linesA[k], oldLine: k + 1, newLine: k + 1 });
  }

  const midA = linesA.slice(prefixLen, n - suffixLen);
  const midB = linesB.slice(prefixLen, m - suffixLen);
  const midN = midA.length;
  const midM = midB.length;

  if (midN > 0 || midM > 0) {
    if (midN * midM < 2000000) {
      const dp = Array.from({ length: midN + 1 }, () => new Int32Array(midM + 1));
      for (let i = 0; i < midN; i++) {
        for (let j = 0; j < midM; j++) {
          if (midA[i] === midB[j]) {
            dp[i + 1][j + 1] = dp[i][j] + 1;
          } else {
            dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
          }
        }
      }
      let i = midN;
      let j = midM;
      const midDiff: DiffLine[] = [];
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && midA[i - 1] === midB[j - 1]) {
          midDiff.unshift({ type: 'unchanged', text: midA[i - 1], oldLine: prefixLen + i, newLine: prefixLen + j });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          midDiff.unshift({ type: 'added', text: midB[j - 1], oldLine: null, newLine: prefixLen + j });
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          midDiff.unshift({ type: 'deleted', text: midA[i - 1], oldLine: prefixLen + i, newLine: null });
          i--;
        }
      }
      result.push(...midDiff);
    } else {
      for (let i = 0; i < midN; i++) {
        result.push({ type: 'deleted', text: midA[i], oldLine: prefixLen + i + 1, newLine: null });
      }
      for (let j = 0; j < midM; j++) {
        result.push({ type: 'added', text: midB[j], oldLine: null, newLine: prefixLen + j + 1 });
      }
    }
  }

  for (let k = 0; k < suffixLen; k++) {
    const idxA = n - suffixLen + k;
    const idxB = m - suffixLen + k;
    result.push({ type: 'unchanged', text: linesA[idxA], oldLine: idxA + 1, newLine: idxB + 1 });
  }

  return result;
}

export class FileConflictModalComponent {
  private overlay: HTMLElement | null = null;
  private currentOptions: FileConflictOptions | null = null;

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

  public open(options: FileConflictOptions) {
    this.close();
    this.currentOptions = options;

    const { tab, diskContent, localContent } = options;
    const fileName = tab.name;

    this.overlay = document.createElement('div');
    this.overlay.className = 'diff-modal-overlay conflict-modal-overlay';

    this.overlay.innerHTML = `
      <div class="diff-modal-dialog conflict-modal-dialog">
        <div class="diff-modal-header conflict-modal-header">
          <div class="diff-modal-title">
            <span class="diff-file-icon">${getFileIconSvg(fileName, false)}</span>
            <span class="diff-file-path">${this.escapeHtml(tab.path)}</span>
            <span class="conflict-badge">CONFLICT: MODIFIED ON DISK</span>
          </div>
          <div class="diff-modal-actions conflict-modal-actions">
            <button class="btn btn-warning btn-sm" id="btn-conflict-overwrite" title="Save local editor changes to disk, overwriting external changes">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              <span>Overwrite Disk</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-conflict-revert" title="Discard unsaved local changes and reload external disk content">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              <span>Revert to Disk</span>
            </button>
            <button class="diff-modal-close-btn" id="btn-conflict-close" aria-label="Close" title="Keep local unsaved edits with conflict warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="conflict-description-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d29922" stroke-width="2" class="conflict-banner-icon">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span class="conflict-banner-text">
            This file has been modified on disk by an external process or AI agent.
            Red (-) lines represent the external disk version; green (+) lines represent your unsaved editor changes.
          </span>
        </div>
        <div class="diff-modal-body conflict-modal-body">
          <div class="diff-viewer-table" id="conflict-diff-viewer-table">
            <div class="diff-empty-msg">Computing diff...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Event listeners
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    this.overlay.querySelector('#btn-conflict-close')?.addEventListener('click', () => {
      if (options.onKeepBoth) {
        options.onKeepBoth();
      }
      this.close();
    });

    const overwriteBtn = this.overlay.querySelector('#btn-conflict-overwrite') as HTMLButtonElement;
    overwriteBtn?.addEventListener('click', async () => {
      overwriteBtn.disabled = true;
      try {
        await options.onOverwrite();
      } finally {
        this.close();
      }
    });

    const revertBtn = this.overlay.querySelector('#btn-conflict-revert') as HTMLButtonElement;
    revertBtn?.addEventListener('click', async () => {
      revertBtn.disabled = true;
      try {
        await options.onRevert();
      } finally {
        this.close();
      }
    });

    this.renderDiff(diskContent, localContent);
  }

  private renderDiff(diskText: string, localText: string) {
    if (!this.overlay) return;
    const tableEl = this.overlay.querySelector('#conflict-diff-viewer-table') as HTMLElement;
    if (!tableEl) return;

    tableEl.innerHTML = '';
    const diffLines = computeLineDiff(diskText, localText);

    if (diffLines.length === 0) {
      tableEl.innerHTML = `<div class="diff-empty-msg">Contents are identical. No differences found.</div>`;
      return;
    }

    // Header label row
    const headerRow = document.createElement('div');
    headerRow.className = 'diff-row diff-meta-header';
    headerRow.innerHTML = `
      <span class="diff-line-col diff-line-old-hdr" title="External Disk Line #">Disk</span>
      <span class="diff-line-col diff-line-new-hdr" title="Editor Line #">Editor</span>
      <span class="diff-prefix-col"></span>
      <span class="diff-content-col diff-header-label">--- External Disk Version vs +++ Local Editor Version</span>
    `;
    tableEl.appendChild(headerRow);

    for (const line of diffLines) {
      const row = document.createElement('div');

      if (line.type === 'added') {
        row.className = 'diff-row diff-row-added';
        row.innerHTML = `
          <span class="diff-line-col diff-line-old"></span>
          <span class="diff-line-col diff-line-new">${line.newLine ?? ''}</span>
          <span class="diff-prefix-col">+</span>
          <span class="diff-content-col">${this.escapeHtml(line.text)}</span>
        `;
      } else if (line.type === 'deleted') {
        row.className = 'diff-row diff-row-deleted';
        row.innerHTML = `
          <span class="diff-line-col diff-line-old">${line.oldLine ?? ''}</span>
          <span class="diff-line-col diff-line-new"></span>
          <span class="diff-prefix-col">-</span>
          <span class="diff-content-col">${this.escapeHtml(line.text)}</span>
        `;
      } else {
        row.className = 'diff-row diff-row-context';
        row.innerHTML = `
          <span class="diff-line-col diff-line-old">${line.oldLine ?? ''}</span>
          <span class="diff-line-col diff-line-new">${line.newLine ?? ''}</span>
          <span class="diff-prefix-col"> </span>
          <span class="diff-content-col">${this.escapeHtml(line.text)}</span>
        `;
      }

      tableEl.appendChild(row);
    }
  }

  public close() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.currentOptions = null;
  }

  public isOpen(): boolean {
    return this.overlay !== null;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
