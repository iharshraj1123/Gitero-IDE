import { gitService, GitFileChange, GitState } from '../services/git';
import { fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';
import { diffModal } from './diffModal';

export class GitPanelComponent {
  private container: HTMLElement;
  private isLoading: boolean = false;

  private branchLabel!: HTMLElement;
  private commitInput!: HTMLTextAreaElement;
  private commitBtn!: HTMLButtonElement;
  private stagedHeader!: HTMLElement;
  private stagedList!: HTMLElement;
  private stagedCountBadge!: HTMLElement;
  private changesHeader!: HTMLElement;
  private changesList!: HTMLElement;
  private changesCountBadge!: HTMLElement;
  private statusMessage!: HTMLElement;
  private emptyStateEl!: HTMLElement;
  private bodyEl!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
    this.setupListeners();

    // Subscribe to Git state changes
    gitService.onStatusChange((state) => {
      this.updateView(state);
    });
  }

  private build() {
    this.container.innerHTML = `
      <div class="sidebar-header">
        <span>SOURCE CONTROL</span>
        <div class="sidebar-actions">
          <button class="sidebar-action-btn" id="btn-git-refresh" title="Refresh Git Status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          </button>
          <button class="sidebar-action-btn" id="btn-git-pull" title="Pull from Remote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/><path d="M12 3v14"/><path d="M20 21H4"/></svg>
          </button>
          <button class="sidebar-action-btn" id="btn-git-push" title="Push Changes to Remote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/><path d="M12 9v12"/><path d="M20 4H4"/></svg>
          </button>
        </div>
      </div>

      <div class="git-panel-body" id="git-panel-body">
        <div class="git-branch-bar" id="git-branch-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
          <span class="git-branch-text" id="git-panel-branch">Checking...</span>
        </div>

        <div class="git-commit-box">
          <textarea class="git-commit-input" id="git-commit-input" placeholder="Message (Ctrl+Enter to commit)" rows="2" spellcheck="false"></textarea>
          <div class="git-commit-actions">
            <button class="btn-git-action btn-git-commit" id="btn-git-commit-action">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Commit</span>
            </button>
          </div>
        </div>

        <!-- STAGED CHANGES SECTION -->
        <div class="git-section-group" id="git-staged-group">
          <div class="git-section-header" id="git-staged-header">
            <div class="git-section-title-wrap">
              <svg class="git-section-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              <span class="git-section-title">STAGED CHANGES</span>
              <span class="git-count-badge" id="git-staged-count">0</span>
            </div>
            <div class="git-section-actions">
              <button class="git-sec-action-btn" id="btn-git-unstage-all" title="Unstage All Changes">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
          <div class="git-changes-list" id="git-staged-list"></div>
        </div>

        <!-- WORKING CHANGES SECTION -->
        <div class="git-section-group" id="git-changes-group">
          <div class="git-section-header" id="git-changes-header">
            <div class="git-section-title-wrap">
              <svg class="git-section-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              <span class="git-section-title">CHANGES</span>
              <span class="git-count-badge" id="git-changes-count">0</span>
            </div>
            <div class="git-section-actions">
              <button class="git-sec-action-btn" id="btn-git-stage-all" title="Stage All Changes">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button class="git-sec-action-btn" id="btn-git-discard-all" title="Discard All Changes">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>
          </div>
          <div class="git-changes-list" id="git-changes-list"></div>
        </div>

        <div class="git-status-note" id="git-status-note"></div>
      </div>

      <div class="git-empty-state" id="git-empty-state" style="display: none;">
        <p>No git repository detected in this workspace.</p>
        <button class="btn-init-git" id="btn-init-git">Initialize Git Repository</button>
      </div>
    `;

    this.bodyEl = this.container.querySelector('#git-panel-body') as HTMLElement;
    this.emptyStateEl = this.container.querySelector('#git-empty-state') as HTMLElement;
    this.branchLabel = this.container.querySelector('#git-panel-branch') as HTMLElement;
    this.commitInput = this.container.querySelector('#git-commit-input') as HTMLTextAreaElement;
    this.commitBtn = this.container.querySelector('#btn-git-commit-action') as HTMLButtonElement;

    this.stagedHeader = this.container.querySelector('#git-staged-header') as HTMLElement;
    this.stagedList = this.container.querySelector('#git-staged-list') as HTMLElement;
    this.stagedCountBadge = this.container.querySelector('#git-staged-count') as HTMLElement;

    this.changesHeader = this.container.querySelector('#git-changes-header') as HTMLElement;
    this.changesList = this.container.querySelector('#git-changes-list') as HTMLElement;
    this.changesCountBadge = this.container.querySelector('#git-changes-count') as HTMLElement;

    this.statusMessage = this.container.querySelector('#git-status-note') as HTMLElement;
  }

  private setupListeners() {
    this.container.querySelector('#btn-git-refresh')?.addEventListener('click', () => {
      this.refresh();
    });

    this.container.querySelector('#btn-git-push')?.addEventListener('click', () => {
      this.pushChanges();
    });

    this.container.querySelector('#btn-git-pull')?.addEventListener('click', () => {
      this.pullChanges();
    });

    this.container.querySelector('#btn-git-stage-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      gitService.stageAll();
    });

    this.container.querySelector('#btn-git-unstage-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      gitService.unstageAll();
    });

    this.container.querySelector('#btn-git-discard-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Discard ALL uncommitted working tree changes? This cannot be undone.')) {
        gitService.discardAll();
      }
    });

    this.commitBtn.addEventListener('click', () => {
      this.commitChanges();
    });

    this.commitInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.commitChanges();
      }
    });

    this.container.querySelector('#btn-init-git')?.addEventListener('click', async () => {
      this.statusMessage.textContent = 'Initializing git repository...';
      const success = await gitService.initRepo();
      if (!success) {
        alert('Failed to initialize Git repository.');
      }
    });
  }

  async refresh() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      await gitService.refresh();
    } finally {
      this.isLoading = false;
    }
  }

  private updateView(state: GitState) {
    const ws = fsService.getWorkspace();
    if (!ws) {
      this.bodyEl.style.display = 'none';
      this.emptyStateEl.style.display = 'flex';
      this.emptyStateEl.querySelector('p')!.textContent = 'Open a workspace folder to use Git.';
      (this.emptyStateEl.querySelector('#btn-init-git') as HTMLElement).style.display = 'none';
      return;
    }

    if (!state.isRepo) {
      this.bodyEl.style.display = 'none';
      this.emptyStateEl.style.display = 'flex';
      this.emptyStateEl.querySelector('p')!.textContent = 'No git repository detected in this workspace.';
      (this.emptyStateEl.querySelector('#btn-init-git') as HTMLElement).style.display = 'block';
      return;
    }

    this.bodyEl.style.display = 'flex';
    this.emptyStateEl.style.display = 'none';
    this.branchLabel.textContent = state.branch || 'main';

    // Render Staged Changes
    this.renderFileList(this.stagedList, state.stagedChanges, true);
    this.stagedCountBadge.textContent = `${state.stagedChanges.length}`;
    const stagedGroup = this.container.querySelector('#git-staged-group') as HTMLElement;
    if (stagedGroup) {
      stagedGroup.style.display = state.stagedChanges.length > 0 ? 'block' : 'none';
    }

    // Render Working Changes
    this.renderFileList(this.changesList, state.workingChanges, false);
    this.changesCountBadge.textContent = `${state.workingChanges.length}`;

    // Clean tree note
    if (state.totalChanges === 0) {
      this.statusMessage.textContent = 'Working tree clean. No changes.';
    } else {
      this.statusMessage.textContent = '';
    }

    // Update Commit button label
    const commitSpan = this.commitBtn.querySelector('span');
    if (commitSpan) {
      if (state.stagedChanges.length > 0) {
        commitSpan.textContent = `Commit (${state.stagedChanges.length} staged)`;
      } else if (state.workingChanges.length > 0) {
        commitSpan.textContent = `Commit All (${state.workingChanges.length})`;
      } else {
        commitSpan.textContent = 'Commit';
      }
    }
  }

  private renderFileList(container: HTMLElement, items: GitFileChange[], isStaged: boolean) {
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = `<div class="git-clean-msg">${isStaged ? 'No staged changes' : 'No working changes'}</div>`;
      return;
    }

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'git-change-row';

      const fileName = item.relativePath.split('/').pop() || item.relativePath;
      const dirPart = item.relativePath.substring(0, item.relativePath.length - fileName.length);

      const iconSpan = document.createElement('span');
      iconSpan.className = 'tree-icon';
      iconSpan.innerHTML = getFileIconSvg(fileName, false);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'git-file-name';
      titleSpan.innerHTML = `<span class="filename-main">${fileName}</span> <span class="file-dir-sub">${dirPart}</span>`;

      // Status letter badge (M, U, D, A, etc.) - STRICTLY TEXT/VECTOR, NO EMOJIS
      const badgeSpan = document.createElement('span');
      badgeSpan.className = `git-status-code status-${item.status.toLowerCase()}`;
      badgeSpan.textContent = item.status;

      // Action buttons
      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'git-row-actions';

      // 1. Stage / Unstage button
      const stageBtn = document.createElement('button');
      stageBtn.className = 'git-action-icon-btn';
      stageBtn.title = isStaged ? 'Unstage Changes' : 'Stage Changes';
      stageBtn.innerHTML = isStaged 
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      stageBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isStaged) {
          await gitService.unstageFile(item.relativePath);
        } else {
          await gitService.stageFile(item.relativePath);
        }
      });
      actionsGroup.appendChild(stageBtn);

      // 2. Discard button (only for unstaged changes)
      if (!isStaged) {
        const discardBtn = document.createElement('button');
        discardBtn.className = 'git-action-icon-btn';
        discardBtn.title = 'Discard Changes';
        discardBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
        discardBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmDiscard = confirm(`Discard changes to "${item.relativePath}"? This cannot be undone.`);
          if (confirmDiscard) {
            await gitService.discardFile(item.relativePath, item.status === 'U');
          }
        });
        actionsGroup.appendChild(discardBtn);
      }

      // 3. View Diff button
      const diffBtn = document.createElement('button');
      diffBtn.className = 'git-action-icon-btn';
      diffBtn.title = 'Open Changes (Diff)';
      diffBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>`;
      diffBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        diffModal.open(item, isStaged);
      });
      actionsGroup.appendChild(diffBtn);

      row.appendChild(iconSpan);
      row.appendChild(titleSpan);
      row.appendChild(actionsGroup);
      row.appendChild(badgeSpan);

      // Clicking row opens diff modal directly
      row.addEventListener('click', () => {
        diffModal.open(item, isStaged);
      });

      container.appendChild(row);
    }
  }

  async commitChanges() {
    const msg = this.commitInput.value.trim();
    if (!msg) {
      alert('Please enter a commit message.');
      return;
    }

    const state = gitService.getState();
    if (state.totalChanges === 0) {
      alert('No changes to commit.');
      return;
    }

    this.commitBtn.disabled = true;
    this.statusMessage.textContent = 'Committing changes...';

    const res = await gitService.commit(msg);
    this.commitBtn.disabled = false;

    if (res.success) {
      this.commitInput.value = '';
      this.statusMessage.textContent = 'Committed successfully.';
    } else {
      this.statusMessage.textContent = `Commit failed: ${res.error}`;
      alert(`Commit error: ${res.error}`);
    }
  }

  async pushChanges() {
    this.statusMessage.textContent = 'Pushing changes to remote...';
    const res = await gitService.push();
    if (res.success) {
      this.statusMessage.textContent = 'Push completed successfully.';
    } else {
      this.statusMessage.textContent = `Push error: ${res.error}`;
      alert(`Push error: ${res.error}`);
    }
  }

  async pullChanges() {
    this.statusMessage.textContent = 'Pulling changes from remote...';
    const res = await gitService.pull();
    if (res.success) {
      this.statusMessage.textContent = 'Pull completed successfully.';
    } else {
      this.statusMessage.textContent = `Pull error: ${res.error}`;
      alert(`Pull error: ${res.error}`);
    }
  }
}
