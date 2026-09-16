import { isNative } from '../services/neutralino';
import { fsService } from '../services/fs';
import { editorState } from '../state/editorState';
import { getFileIconSvg } from './icons';

export interface GitFileChange {
  path: string;
  relativePath: string;
  status: 'M' | 'U' | 'D' | 'A' | 'R' | '?';
  isStaged: boolean;
}

export class GitPanelComponent {
  private container: HTMLElement;
  private currentBranch: string = '';
  private isGitRepo: boolean = false;
  private changes: GitFileChange[] = [];
  private isLoading: boolean = false;

  private branchLabel!: HTMLElement;
  private commitInput!: HTMLTextAreaElement;
  private commitBtn!: HTMLButtonElement;
  private changesList!: HTMLElement;
  private statusMessage!: HTMLElement;
  private changesCountBadge!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.build();
    this.refresh();
  }

  private build() {
    this.container.innerHTML = `
      <div class="sidebar-header">
        <span>SOURCE CONTROL</span>
        <div class="sidebar-actions">
          <button class="sidebar-action-btn" id="btn-git-refresh" title="Refresh Git Status">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
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
              Commit All
            </button>
          </div>
        </div>

        <div class="git-section-header">
          <span class="git-section-title">CHANGES</span>
          <span class="git-count-badge" id="git-changes-count">0</span>
        </div>

        <div class="git-changes-list" id="git-changes-list"></div>

        <div class="git-status-note" id="git-status-note"></div>
      </div>

      <div class="git-empty-state" id="git-empty-state" style="display: none;">
        <p>No git repository detected in this workspace.</p>
        <button class="btn-init-git" id="btn-init-git">Initialize Git Repository</button>
      </div>
    `;

    this.branchLabel = this.container.querySelector('#git-panel-branch') as HTMLElement;
    this.commitInput = this.container.querySelector('#git-commit-input') as HTMLTextAreaElement;
    this.commitBtn = this.container.querySelector('#btn-git-commit-action') as HTMLButtonElement;
    this.changesList = this.container.querySelector('#git-changes-list') as HTMLElement;
    this.statusMessage = this.container.querySelector('#git-status-note') as HTMLElement;
    this.changesCountBadge = this.container.querySelector('#git-changes-count') as HTMLElement;

    this.setupListeners();
  }

  private setupListeners() {
    this.container.querySelector('#btn-git-refresh')?.addEventListener('click', () => {
      this.refresh();
    });

    this.container.querySelector('#btn-git-push')?.addEventListener('click', () => {
      this.pushChanges();
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

    this.container.querySelector('#btn-init-git')?.addEventListener('click', () => {
      this.initGitRepo();
    });
  }

  private async runGitCommand(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!isNative()) {
      return { stdout: '', stderr: 'Git not supported in web mode', exitCode: 1 };
    }

    const ws = fsService.getWorkspace();
    if (!ws) {
      return { stdout: '', stderr: 'No workspace open', exitCode: 1 };
    }

    const cmd = `cd /d "${ws}" && git ${args}`;
    try {
      const res = await window.Neutralino.os.execCommand(cmd);
      return {
        stdout: res.stdOut || '',
        stderr: res.stdErr || '',
        exitCode: res.exitCode
      };
    } catch (err: any) {
      return {
        stdout: '',
        stderr: err?.message || String(err),
        exitCode: 1
      };
    }
  }

  async refresh() {
    if (this.isLoading) return;
    this.isLoading = true;

    const bodyEl = this.container.querySelector('#git-panel-body') as HTMLElement;
    const emptyEl = this.container.querySelector('#git-empty-state') as HTMLElement;

    const ws = fsService.getWorkspace();
    if (!ws) {
      bodyEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      emptyEl.querySelector('p')!.textContent = 'Open a workspace folder to use Git.';
      (emptyEl.querySelector('#btn-init-git') as HTMLElement).style.display = 'none';
      this.isLoading = false;
      return;
    }

    // Check if git repo
    const checkRepo = await this.runGitCommand('rev-parse --is-inside-work-tree');
    if (checkRepo.exitCode !== 0 || !checkRepo.stdout.includes('true')) {
      this.isGitRepo = false;
      bodyEl.style.display = 'none';
      emptyEl.style.display = 'flex';
      emptyEl.querySelector('p')!.textContent = 'No git repository detected in this workspace.';
      (emptyEl.querySelector('#btn-init-git') as HTMLElement).style.display = 'block';
      this.isLoading = false;
      return;
    }

    this.isGitRepo = true;
    bodyEl.style.display = 'flex';
    emptyEl.style.display = 'none';

    // Get current branch
    const branchRes = await this.runGitCommand('branch --show-current');
    this.currentBranch = branchRes.stdout.trim() || 'HEAD (detached)';
    this.branchLabel.textContent = this.currentBranch;

    // Get status porcelain
    const statusRes = await this.runGitCommand('status --porcelain');
    this.changes = this.parseStatusOutput(statusRes.stdout, ws);
    this.renderChanges();
    this.isLoading = false;
  }

  private parseStatusOutput(stdout: string, ws: string): GitFileChange[] {
    const list: GitFileChange[] = [];
    const lines = stdout.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      if (line.length < 3) continue;
      const indexCode = line[0];
      const workCode = line[1];
      const relPath = line.substring(3).trim().replace(/^"/, '').replace(/"$/, '');

      let status: 'M' | 'U' | 'D' | 'A' | 'R' | '?' = 'M';
      let isStaged = false;

      if (indexCode === '?' || workCode === '?') {
        status = 'U';
      } else if (indexCode === 'D' || workCode === 'D') {
        status = 'D';
      } else if (indexCode === 'A' || workCode === 'A') {
        status = 'A';
      } else if (indexCode === 'R' || workCode === 'R') {
        status = 'R';
      } else {
        status = 'M';
      }

      if (indexCode !== ' ' && indexCode !== '?') {
        isStaged = true;
      }

      const sep = ws.includes('/') ? '/' : '\\';
      const fullPath = ws.endsWith(sep) ? `${ws}${relPath}` : `${ws}${sep}${relPath}`;

      list.push({
        path: fullPath,
        relativePath: relPath,
        status,
        isStaged
      });
    }

    return list;
  }

  private renderChanges() {
    this.changesList.innerHTML = '';
    this.changesCountBadge.textContent = `${this.changes.length}`;

    if (this.changes.length === 0) {
      this.changesList.innerHTML = `<div class="git-clean-msg">Working tree clean. No changes.</div>`;
      this.statusMessage.textContent = '';
      return;
    }

    for (const item of this.changes) {
      const row = document.createElement('div');
      row.className = 'git-change-row';

      const fileName = item.relativePath.split(/[/\\]/).pop() || item.relativePath;
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

      // Hover actions
      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'git-row-actions';

      const discardBtn = document.createElement('button');
      discardBtn.className = 'git-action-icon-btn';
      discardBtn.title = 'Discard Changes';
      discardBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
      discardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.discardChange(item);
      });

      actionsGroup.appendChild(discardBtn);

      row.appendChild(iconSpan);
      row.appendChild(titleSpan);
      row.appendChild(actionsGroup);
      row.appendChild(badgeSpan);

      row.addEventListener('click', async () => {
        try {
          const content = await fsService.readFile(item.path);
          editorState.openFile(item.path, content);
        } catch (err) {
          alert(`Could not open changed file: ${err}`);
        }
      });

      this.changesList.appendChild(row);
    }
  }

  async commitChanges() {
    const msg = this.commitInput.value.trim();
    if (!msg) {
      alert('Please enter a commit message.');
      return;
    }

    if (this.changes.length === 0) {
      alert('No changes to commit.');
      return;
    }

    this.commitBtn.disabled = true;
    this.statusMessage.textContent = 'Committing changes...';

    // Stage all and commit
    const addRes = await this.runGitCommand('add -A');
    if (addRes.exitCode !== 0) {
      this.statusMessage.textContent = `Stage failed: ${addRes.stderr}`;
      this.commitBtn.disabled = false;
      return;
    }

    // Escape quotes in commit message
    const safeMsg = msg.replace(/"/g, '\\"');
    const commitRes = await this.runGitCommand(`commit -m "${safeMsg}"`);

    this.commitBtn.disabled = false;
    if (commitRes.exitCode === 0) {
      this.commitInput.value = '';
      this.statusMessage.textContent = 'Committed successfully.';
      await this.refresh();
    } else {
      this.statusMessage.textContent = `Commit failed: ${commitRes.stderr}`;
    }
  }

  async pushChanges() {
    this.statusMessage.textContent = 'Pushing changes to remote...';
    const pushRes = await this.runGitCommand('push');
    if (pushRes.exitCode === 0) {
      this.statusMessage.textContent = 'Push completed successfully.';
      await this.refresh();
    } else {
      this.statusMessage.textContent = `Push error: ${pushRes.stderr || pushRes.stdout}`;
    }
  }

  async discardChange(item: GitFileChange) {
    const confirmDiscard = confirm(`Discard changes to "${item.relativePath}"? This cannot be undone.`);
    if (!confirmDiscard) return;

    if (item.status === 'U') {
      await this.runGitCommand(`clean -f "${item.relativePath}"`);
    } else {
      await this.runGitCommand(`checkout -- "${item.relativePath}"`);
    }

    await this.refresh();
  }

  async initGitRepo() {
    this.statusMessage.textContent = 'Initializing git repository...';
    const initRes = await this.runGitCommand('init');
    if (initRes.exitCode === 0) {
      this.statusMessage.textContent = 'Git repository initialized.';
      await this.refresh();
    } else {
      alert(`Failed to initialize git repository: ${initRes.stderr}`);
    }
  }
}
