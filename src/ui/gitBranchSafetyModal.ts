/**
 * Git Branch Safety Modal Component
 * Prompts the developer when attempting to switch or create branches while
 * uncommitted changes exist in the workspace, providing industry-standard options
 * (Bring Changes / Stash Changes / Discard Changes / Cancel).
 */

import { GitFileChange } from '../services/git';

export interface GitBranchSafetyOptions {
  targetBranch: string;
  currentBranch: string;
  isNewBranch: boolean;
  uncommittedFiles: GitFileChange[];
  onBringChanges: () => Promise<void> | void;
  onStashChanges: () => Promise<void> | void;
  onDiscardChanges: () => Promise<void> | void;
  onCancel?: () => void;
}

export class GitBranchSafetyModal {
  private overlay: HTMLElement | null = null;

  public show(options: GitBranchSafetyOptions) {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay git-branch-safety-overlay';
    this.overlay = overlay;

    const fileCount = options.uncommittedFiles.length;
    const fileLabel = fileCount === 1 ? '1 uncommitted file' : `${fileCount} uncommitted files`;
    const actionLabel = options.isNewBranch ? 'Creating & switching to' : 'Switching to';

    overlay.innerHTML = `
      <div class="git-branch-safety-modal">
        <div class="git-safety-header">
          <div class="git-safety-title-wrap">
            <svg class="git-safety-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <div class="git-safety-title">Uncommitted Changes Detected</div>
              <div class="git-safety-subtitle">${actionLabel} <code>${this.escapeHtml(options.targetBranch)}</code></div>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-safety-close" title="Cancel (Esc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="git-safety-body">
          <p class="git-safety-desc">
            You have <strong>${fileLabel}</strong> in your working tree. How would you like to handle your work before switching branches?
          </p>

          <div class="git-safety-files-box">
            ${options.uncommittedFiles.map(f => `
              <div class="git-safety-file-row">
                <span class="git-status-code status-${f.status.toLowerCase()}">${f.status}</span>
                <span class="git-safety-file-path" title="${this.escapeHtml(f.relativePath)}">${this.escapeHtml(f.relativePath)}</span>
              </div>
            `).join('')}
          </div>

          <div class="git-safety-actions-list">
            <button class="git-safety-action-card" id="btn-safety-bring">
              <div class="git-safety-action-content">
                <div class="git-safety-action-name">
                  <span>Bring Changes to ${this.escapeHtml(options.targetBranch)}</span>
                  <span class="git-safety-badge-rec">Recommended</span>
                </div>
                <div class="git-safety-action-desc">Stash changes, checkout target branch, and automatically apply edits onto the new branch.</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button class="git-safety-action-card" id="btn-safety-stash">
              <div class="git-safety-action-content">
                <div class="git-safety-action-name">Stash Changes & Switch Clean</div>
                <div class="git-safety-action-desc">Save changes to stash on "${this.escapeHtml(options.currentBranch)}" and switch with a clean working tree.</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button class="git-safety-action-card git-safety-action-danger" id="btn-safety-discard">
              <div class="git-safety-action-content">
                <div class="git-safety-action-name">Discard Local Changes</div>
                <div class="git-safety-action-desc">Permanently discard all uncommitted edits and force checkout target branch.</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <div class="git-safety-footer">
          <button class="btn btn-secondary btn-sm" id="btn-safety-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btn-safety-close') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('#btn-safety-cancel') as HTMLButtonElement;
    const bringBtn = overlay.querySelector('#btn-safety-bring') as HTMLButtonElement;
    const stashBtn = overlay.querySelector('#btn-safety-stash') as HTMLButtonElement;
    const discardBtn = overlay.querySelector('#btn-safety-discard') as HTMLButtonElement;

    const handleClose = () => {
      this.close();
      options.onCancel?.();
    };

    closeBtn?.addEventListener('click', handleClose);
    cancelBtn?.addEventListener('click', handleClose);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleClose();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', handleKeyDown);
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    bringBtn?.addEventListener('click', async () => {
      this.setDisabled(overlay, true);
      try {
        await options.onBringChanges();
      } finally {
        this.close();
      }
    });

    stashBtn?.addEventListener('click', async () => {
      this.setDisabled(overlay, true);
      try {
        await options.onStashChanges();
      } finally {
        this.close();
      }
    });

    discardBtn?.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to discard all uncommitted changes? This cannot be undone.`)) {
        this.setDisabled(overlay, true);
        try {
          await options.onDiscardChanges();
        } finally {
          this.close();
        }
      }
    });
  }

  private setDisabled(overlay: HTMLElement, disabled: boolean) {
    const buttons = overlay.querySelectorAll('button');
    buttons.forEach(b => { b.disabled = disabled; });
  }

  public close() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
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

export const gitBranchSafetyModal = new GitBranchSafetyModal();
