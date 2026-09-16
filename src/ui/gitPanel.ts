import { gitService, GitFileChange, GitState } from '../services/git';
import { fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';
import { diffModal } from './diffModal';
import { MenuController, MenuItem } from './menu';
import { GitGraphSidebarComponent } from './gitGraph';

export interface GitPanelOptions {
  onOpenGitGraph?: () => void;
  onShowGitOutput?: () => void;
}

export class GitPanelComponent {
  private container: HTMLElement;
  private options: GitPanelOptions;
  private isLoading: boolean = false;
  private viewMode: 'tree' | 'list' = 'list';
  private sortMode: 'name' | 'path' | 'status' = 'path';

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
  private sidebarGraph?: GitGraphSidebarComponent;

  constructor(container: HTMLElement, options: GitPanelOptions = {}) {
    this.container = container;
    this.options = options;
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
          <button class="sidebar-action-btn" id="btn-git-more" title="More Actions...">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>

      <div class="git-panel-body" id="git-panel-body">
        <div class="git-branch-bar" id="git-branch-bar" title="Click to Switch or Create Branch">
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
              <button class="git-sec-action-btn" id="btn-changes-more" title="More Changes Actions...">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            </div>
          </div>
          <div class="git-changes-list" id="git-changes-list"></div>
        </div>

        <div class="git-status-note" id="git-status-note"></div>

        <!-- GRAPH SECTION ACCORDION -->
        <div class="git-section-group git-graph-section" id="git-graph-section"></div>
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

    // Initialize compact Sidebar Graph Accordion
    const graphSectionEl = this.container.querySelector('#git-graph-section') as HTMLElement;
    this.sidebarGraph = new GitGraphSidebarComponent(graphSectionEl, {
      onOpenFullView: () => {
        if (this.options.onOpenGitGraph) {
          this.options.onOpenGitGraph();
        }
      }
    });
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

    // Top "..." More Actions menu
    this.container.querySelector('#btn-git-more')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showGitMenu(e.currentTarget as HTMLElement);
    });

    // Changes "..." More Actions menu
    this.container.querySelector('#btn-changes-more')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showGitMenu(e.currentTarget as HTMLElement);
    });

    // Branch bar click to prompt checkout / switch
    this.branchLabel.parentElement?.addEventListener('click', () => {
      this.promptCheckout();
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

  public showGitMenu(anchorEl: HTMLElement) {
    const items: MenuItem[] = [
      {
        label: this.viewMode === 'tree' ? 'View as List' : 'View as Tree',
        action: () => {
          this.viewMode = this.viewMode === 'tree' ? 'list' : 'tree';
          this.updateView(gitService.getState());
        }
      },
      {
        label: 'View & Sort',
        submenu: [
          {
            label: 'Sort by Name',
            checked: () => this.sortMode === 'name',
            action: () => {
              this.sortMode = 'name';
              this.updateView(gitService.getState());
            }
          },
          {
            label: 'Sort by Path',
            checked: () => this.sortMode === 'path',
            action: () => {
              this.sortMode = 'path';
              this.updateView(gitService.getState());
            }
          },
          {
            label: 'Sort by Status',
            checked: () => this.sortMode === 'status',
            action: () => {
              this.sortMode = 'status';
              this.updateView(gitService.getState());
            }
          }
        ]
      },
      { label: '', divider: true },
      {
        label: 'Pull',
        action: () => this.pullChanges()
      },
      {
        label: 'Push',
        action: () => this.pushChanges()
      },
      {
        label: 'Clone',
        action: () => this.promptClone()
      },
      {
        label: 'Checkout to...',
        action: () => this.promptCheckout()
      },
      {
        label: 'Fetch',
        action: () => this.fetchChanges()
      },
      { label: '', divider: true },
      {
        label: 'Commit',
        submenu: [
          {
            label: 'Commit',
            action: () => this.commitChanges()
          },
          {
            label: 'Commit (Amend)',
            action: () => this.promptCommitAmend()
          },
          {
            label: 'Commit Staged',
            action: () => this.commitStaged(false)
          },
          {
            label: 'Commit Staged (Amend)',
            action: () => this.commitStaged(true)
          },
          {
            label: 'Commit All',
            action: () => this.commitAll()
          }
        ]
      },
      {
        label: 'Changes',
        submenu: [
          {
            label: 'Stage All Changes',
            action: () => gitService.stageAll()
          },
          {
            label: 'Unstage All Changes',
            action: () => gitService.unstageAll()
          },
          {
            label: 'Discard All Changes',
            danger: true,
            action: () => {
              if (confirm('Discard ALL uncommitted changes? This cannot be undone.')) {
                gitService.discardAll();
              }
            }
          }
        ]
      },
      {
        label: 'Pull, Push',
        submenu: [
          {
            label: 'Pull',
            action: () => this.pullChanges()
          },
          {
            label: 'Push',
            action: () => this.pushChanges()
          },
          {
            label: 'Sync',
            action: async () => {
              await this.pullChanges();
              await this.pushChanges();
            }
          },
          {
            label: 'Pull from...',
            action: () => this.promptPullFrom()
          },
          {
            label: 'Push to...',
            action: () => this.promptPushTo()
          }
        ]
      },
      {
        label: 'Branch',
        submenu: [
          {
            label: 'Create Branch...',
            action: () => this.promptCreateBranch()
          },
          {
            label: 'Create Branch From...',
            action: () => this.promptCreateBranchFrom()
          },
          {
            label: 'Checkout to...',
            action: () => this.promptCheckout()
          },
          {
            label: 'Rename Branch...',
            action: () => this.promptRenameBranch()
          },
          {
            label: 'Delete Branch...',
            danger: true,
            action: () => this.promptDeleteBranch()
          },
          {
            label: 'Merge Branch...',
            action: () => this.promptMergeBranch()
          }
        ]
      },
      {
        label: 'Remote',
        submenu: [
          {
            label: 'Add Remote...',
            action: () => this.promptAddRemote()
          },
          {
            label: 'Remove Remote...',
            danger: true,
            action: () => this.promptRemoveRemote()
          },
          {
            label: 'Fetch from Remote...',
            action: () => this.fetchChanges()
          }
        ]
      },
      {
        label: 'Stash',
        submenu: [
          {
            label: 'Stash',
            action: () => this.promptStash(false)
          },
          {
            label: 'Stash (Include Untracked)',
            action: () => this.promptStash(true)
          },
          {
            label: 'Apply Latest Stash',
            action: () => this.applyStash()
          },
          {
            label: 'Pop Latest Stash',
            action: () => this.popStash()
          },
          {
            label: 'Drop Stash...',
            danger: true,
            action: () => this.dropStash()
          }
        ]
      },
      {
        label: 'Tags',
        submenu: [
          {
            label: 'Create Tag...',
            action: () => this.promptCreateTag()
          },
          {
            label: 'Delete Tag...',
            danger: true,
            action: () => this.promptDeleteTag()
          }
        ]
      },
      { label: '', divider: true },
      {
        label: 'Show Git Output',
        action: () => {
          if (this.options.onShowGitOutput) {
            this.options.onShowGitOutput();
          }
        }
      }
    ];

    MenuController.showAtElement(anchorEl, items, 'right');
  }

  async refresh() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      await gitService.refresh();
      this.sidebarGraph?.reload();
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

    const sortedStaged = this.sortChanges([...state.stagedChanges]);
    const sortedWorking = this.sortChanges([...state.workingChanges]);

    // Render Staged Changes
    this.renderFileList(this.stagedList, sortedStaged, true);
    this.stagedCountBadge.textContent = `${state.stagedChanges.length}`;
    const stagedGroup = this.container.querySelector('#git-staged-group') as HTMLElement;
    if (stagedGroup) {
      stagedGroup.style.display = state.stagedChanges.length > 0 ? 'block' : 'none';
    }

    // Render Working Changes
    this.renderFileList(this.changesList, sortedWorking, false);
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

  private sortChanges(items: GitFileChange[]): GitFileChange[] {
    return items.sort((a, b) => {
      if (this.sortMode === 'name') {
        const nameA = a.relativePath.split('/').pop() || a.relativePath;
        const nameB = b.relativePath.split('/').pop() || b.relativePath;
        return nameA.localeCompare(nameB);
      } else if (this.sortMode === 'status') {
        return a.status.localeCompare(b.status);
      }
      // default: path
      return a.relativePath.localeCompare(b.relativePath);
    });
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

  async commitAll() {
    let msg = this.commitInput.value.trim();
    if (!msg) {
      msg = prompt('Enter commit message:') || '';
      if (!msg.trim()) return;
    }
    await gitService.stageAll();
    const res = await gitService.commit(msg);
    if (res.success) {
      this.commitInput.value = '';
      this.statusMessage.textContent = 'Committed all changes.';
    } else {
      alert(`Commit error: ${res.error}`);
    }
  }

  async commitStaged(amend: boolean = false) {
    let msg = this.commitInput.value.trim();
    if (amend) {
      const amendRes = await gitService.commitAmend(msg || undefined);
      if (amendRes.success) {
        this.statusMessage.textContent = 'Amended previous commit.';
      } else {
        alert(`Amend error: ${amendRes.error}`);
      }
      return;
    }

    if (!msg) {
      msg = prompt('Enter commit message for staged changes:') || '';
      if (!msg.trim()) return;
    }
    const res = await gitService.commit(msg);
    if (res.success) {
      this.commitInput.value = '';
      this.statusMessage.textContent = 'Committed staged changes.';
    } else {
      alert(`Commit error: ${res.error}`);
    }
  }

  async promptCommitAmend() {
    const msg = prompt('Enter updated commit message (leave empty to keep original message):');
    if (msg === null) return;
    const res = await gitService.commitAmend(msg.trim() || undefined);
    if (res.success) {
      this.statusMessage.textContent = 'Amended commit successfully.';
    } else {
      alert(`Amend failed: ${res.error}`);
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

  async fetchChanges() {
    this.statusMessage.textContent = 'Fetching from remote...';
    const res = await gitService.fetch();
    if (res.success) {
      this.statusMessage.textContent = 'Fetch completed successfully.';
    } else {
      alert(`Fetch error: ${res.error}`);
    }
  }

  async promptClone() {
    const url = prompt('Enter Git repository URL to clone:');
    if (!url?.trim()) return;
    const targetDir = prompt('Enter target destination directory:', 'C:\\');
    if (!targetDir?.trim()) return;

    this.statusMessage.textContent = `Cloning repository ${url}...`;
    const res = await gitService.clone(url, targetDir);
    if (res.success) {
      alert(`Repository cloned successfully into ${targetDir}`);
      this.statusMessage.textContent = 'Clone finished.';
    } else {
      alert(`Clone failed: ${res.error}`);
    }
  }

  async promptCheckout() {
    const branches = await gitService.getBranches();
    const branchNames = branches.map((b) => b.name).join('\n');
    const target = prompt(`Enter branch or commit to checkout:\nAvailable:\n${branchNames}`);
    if (!target?.trim()) return;

    const res = await gitService.checkoutBranch(target.trim());
    if (res.success) {
      this.statusMessage.textContent = `Checked out ${target.trim()}`;
    } else {
      alert(`Checkout error: ${res.error}`);
    }
  }

  async promptCreateBranch() {
    const name = prompt('Enter new branch name:');
    if (!name?.trim()) return;
    const res = await gitService.createAndCheckoutBranch(name.trim());
    if (res.success) {
      this.statusMessage.textContent = `Created and checked out ${name.trim()}`;
    } else {
      alert(`Create branch error: ${res.error}`);
    }
  }

  async promptCreateBranchFrom() {
    const name = prompt('Enter new branch name:');
    if (!name?.trim()) return;
    const startPoint = prompt('Enter starting commit or branch (e.g. main or HEAD~1):');
    if (!startPoint?.trim()) return;
    const res = await gitService.createBranch(name.trim(), startPoint.trim());
    if (res.success) {
      await gitService.checkoutBranch(name.trim());
      this.statusMessage.textContent = `Created and checked out ${name.trim()} from ${startPoint.trim()}`;
    } else {
      alert(`Create branch error: ${res.error}`);
    }
  }

  async promptRenameBranch() {
    const current = gitService.getCurrentBranch();
    const newName = prompt(`Rename branch "${current}" to:`);
    if (!newName?.trim() || newName.trim() === current) return;
    const res = await gitService.renameBranch(current, newName.trim());
    if (res.success) {
      this.statusMessage.textContent = `Branch renamed to ${newName.trim()}`;
    } else {
      alert(`Rename error: ${res.error}`);
    }
  }

  async promptDeleteBranch() {
    const branches = await gitService.getBranches();
    const names = branches.filter((b) => !b.isCurrent).map((b) => b.name).join(', ');
    if (!names) {
      alert('No other branches to delete.');
      return;
    }
    const target = prompt(`Enter branch name to delete:\nAvailable: ${names}`);
    if (!target?.trim()) return;
    if (confirm(`Are you sure you want to delete branch "${target.trim()}"?`)) {
      const res = await gitService.deleteBranch(target.trim(), true);
      if (res.success) {
        this.statusMessage.textContent = `Deleted branch ${target.trim()}`;
      } else {
        alert(`Delete branch error: ${res.error}`);
      }
    }
  }

  async promptMergeBranch() {
    const branches = await gitService.getBranches();
    const names = branches.filter((b) => !b.isCurrent).map((b) => b.name).join(', ');
    const target = prompt(`Enter branch to merge into ${gitService.getCurrentBranch()}:\nAvailable: ${names}`);
    if (!target?.trim()) return;
    const res = await gitService.mergeBranch(target.trim());
    if (res.success) {
      this.statusMessage.textContent = `Merged ${target.trim()}`;
    } else {
      alert(`Merge error: ${res.error}`);
    }
  }

  async promptAddRemote() {
    const name = prompt('Enter remote name (e.g. origin):', 'origin');
    if (!name?.trim()) return;
    const url = prompt(`Enter URL for remote "${name.trim()}":`);
    if (!url?.trim()) return;
    const res = await gitService.addRemote(name.trim(), url.trim());
    if (res.success) {
      this.statusMessage.textContent = `Added remote ${name.trim()}`;
    } else {
      alert(`Add remote error: ${res.error}`);
    }
  }

  async promptRemoveRemote() {
    const remotes = await gitService.getRemotes();
    const names = remotes.map((r) => r.name).join(', ');
    const target = prompt(`Enter remote to remove:\nAvailable: ${names}`);
    if (!target?.trim()) return;
    const res = await gitService.removeRemote(target.trim());
    if (res.success) {
      this.statusMessage.textContent = `Removed remote ${target.trim()}`;
    } else {
      alert(`Remove remote error: ${res.error}`);
    }
  }

  async promptStash(includeUntracked: boolean) {
    const msg = prompt('Enter stash message (optional):');
    if (msg === null) return;
    const res = await gitService.stash(includeUntracked, msg.trim() || undefined);
    if (res.success) {
      this.statusMessage.textContent = 'Changes stashed.';
    } else {
      alert(`Stash error: ${res.error}`);
    }
  }

  async applyStash() {
    const res = await gitService.stashApply();
    if (res.success) {
      this.statusMessage.textContent = 'Applied latest stash.';
    } else {
      alert(`Apply stash error: ${res.error}`);
    }
  }

  async popStash() {
    const res = await gitService.stashPop();
    if (res.success) {
      this.statusMessage.textContent = 'Popped latest stash.';
    } else {
      alert(`Pop stash error: ${res.error}`);
    }
  }

  async dropStash() {
    const stashes = await gitService.getStashList();
    if (stashes.length === 0) {
      alert('No stashes found.');
      return;
    }
    if (confirm(`Drop latest stash (${stashes[0]})?`)) {
      const res = await gitService.stashDrop(0);
      if (res.success) {
        this.statusMessage.textContent = 'Dropped stash.';
      } else {
        alert(`Drop stash error: ${res.error}`);
      }
    }
  }

  async promptCreateTag() {
    const tagName = prompt('Enter tag name (e.g. v0.1.3):');
    if (!tagName?.trim()) return;
    const message = prompt('Enter tag message (optional):');
    const res = await gitService.createTag(tagName.trim(), message?.trim() || undefined);
    if (res.success) {
      this.statusMessage.textContent = `Created tag ${tagName.trim()}`;
    } else {
      alert(`Create tag error: ${res.error}`);
    }
  }

  async promptDeleteTag() {
    const tags = await gitService.getTags();
    const names = tags.slice(0, 10).join(', ');
    const tagName = prompt(`Enter tag name to delete:\nRecent tags: ${names}`);
    if (!tagName?.trim()) return;
    const res = await gitService.deleteTag(tagName.trim());
    if (res.success) {
      this.statusMessage.textContent = `Deleted tag ${tagName.trim()}`;
    } else {
      alert(`Delete tag error: ${res.error}`);
    }
  }

  async promptPullFrom() {
    const remotes = await gitService.getRemotes();
    const names = remotes.map((r) => r.name).join(', ') || 'origin';
    const remote = prompt(`Enter remote to pull from:\nAvailable: ${names}`, 'origin');
    if (!remote?.trim()) return;
    const branch = prompt('Enter remote branch to pull:', gitService.getCurrentBranch());
    if (!branch?.trim()) return;
    this.statusMessage.textContent = `Pulling from ${remote} ${branch}...`;
    const res = await gitService.runGitCommand(`pull ${remote.trim()} ${branch.trim()}`, false);
    await gitService.refresh();
    if (res.exitCode === 0) {
      this.statusMessage.textContent = 'Pull successful.';
    } else {
      alert(`Pull error: ${res.stderr || res.stdout}`);
    }
  }

  async promptPushTo() {
    const remotes = await gitService.getRemotes();
    const names = remotes.map((r) => r.name).join(', ') || 'origin';
    const remote = prompt(`Enter remote to push to:\nAvailable: ${names}`, 'origin');
    if (!remote?.trim()) return;
    const branch = prompt('Enter branch to push:', gitService.getCurrentBranch());
    if (!branch?.trim()) return;
    this.statusMessage.textContent = `Pushing to ${remote} ${branch}...`;
    const res = await gitService.runGitCommand(`push -u ${remote.trim()} ${branch.trim()}`, false);
    await gitService.refresh();
    if (res.exitCode === 0) {
      this.statusMessage.textContent = 'Push successful.';
    } else {
      alert(`Push error: ${res.stderr || res.stdout}`);
    }
  }
}
