import { isNative } from './neutralino';
import { fsService } from './fs';

export interface GitFileChange {
  path: string;           // Absolute path
  relativePath: string;   // Normalized relative path (forward slashes)
  status: 'M' | 'U' | 'D' | 'A' | 'R' | '?';
  isStaged: boolean;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
}

export interface GitRef {
  name: string;
  type: 'head' | 'branch' | 'remote' | 'tag' | 'reflog' | 'dangling';
  isCurrentHead?: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  parentHashes: string[];
  authorName: string;
  authorEmail: string;
  timestamp: number;
  relativeDate: string;
  message: string;
  refs: GitRef[];
  isDangling?: boolean;
}

export interface GitCommitFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | 'U';
  additions?: number;
  deletions?: number;
}

export interface GitCommitDetail extends GitCommit {
  body: string;
  files: GitCommitFile[];
}

export interface GitState {
  isRepo: boolean;
  branch: string;
  stagedChanges: GitFileChange[];
  workingChanges: GitFileChange[];
  totalChanges: number;
}

export type GitStatusChangeListener = (state: GitState) => void;
export type GitOutputListener = (line: string, level?: 'info' | 'warn' | 'error') => void;

export class GitService {
  private state: GitState = {
    isRepo: false,
    branch: '',
    stagedChanges: [],
    workingChanges: [],
    totalChanges: 0
  };

  private fileStatusMap: Map<string, GitFileChange> = new Map();
  private folderChangesMap: Map<string, number> = new Map();
  private listeners: Set<GitStatusChangeListener> = new Set();
  private outputListeners: Set<GitOutputListener> = new Set();
  private isRefreshing: boolean = false;
  private lastStatusFingerprint: string = '';

  constructor() {
    // Initial refresh if workspace is open
    setTimeout(() => {
      if (fsService.getWorkspace()) {
        this.refresh();
      }
    }, 100);
  }

  public getState(): GitState {
    return { ...this.state };
  }

  public isGitRepo(): boolean {
    return this.state.isRepo;
  }

  public getCurrentBranch(): string {
    return this.state.branch;
  }

  public onStatusChange(listener: GitStatusChangeListener): () => void {
    this.listeners.add(listener);
    // Immediately invoke with current state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onOutput(listener: GitOutputListener): () => void {
    this.outputListeners.add(listener);
    return () => {
      this.outputListeners.delete(listener);
    };
  }

  public logOutput(line: string, level: 'info' | 'warn' | 'error' = 'info') {
    this.outputListeners.forEach((listener) => {
      try {
        listener(line, level);
      } catch (err) {
        console.error('[GitService] Output listener error:', err);
      }
    });
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[GitService] Listener notification error:', err);
      }
    });
  }

  public async runGitCommand(args: string, silent: boolean = true, noOptionalLocks: boolean = true): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!silent) {
      this.logOutput(`> git ${args}`, 'info');
    }

    if (!isNative()) {
      if (!silent) this.logOutput('Git not supported in web mode', 'warn');
      return { stdout: '', stderr: 'Git not supported in web mode', exitCode: 1 };
    }

    const ws = fsService.getWorkspace();
    if (!ws) {
      if (!silent) this.logOutput('No workspace folder open', 'warn');
      return { stdout: '', stderr: 'No workspace folder open', exitCode: 1 };
    }

    const gitExec = noOptionalLocks ? 'git --no-optional-locks' : 'git';
    const cmd = `cd /d "${ws}" && ${gitExec} ${args}`;
    try {
      const res = await window.Neutralino.os.execCommand(cmd);
      const stdout = res.stdOut || '';
      const stderr = res.stdErr || '';

      if (!silent) {
        if (stdout.trim()) {
          this.logOutput(stdout.trim(), 'info');
        }
        if (stderr.trim()) {
          this.logOutput(stderr.trim(), res.exitCode === 0 ? 'info' : 'error');
        }
      }

      return {
        stdout,
        stderr,
        exitCode: res.exitCode
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!silent) this.logOutput(msg, 'error');
      return {
        stdout: '',
        stderr: msg,
        exitCode: 1
      };
    }
  }

  public async refresh(force: boolean = false): Promise<GitState> {
    if (this.isRefreshing) return this.state;
    this.isRefreshing = true;

    const ws = fsService.getWorkspace();
    if (!ws) {
      const wasRepo = this.state.isRepo;
      this.state = {
        isRepo: false,
        branch: '',
        stagedChanges: [],
        workingChanges: [],
        totalChanges: 0
      };
      this.fileStatusMap.clear();
      this.folderChangesMap.clear();
      this.lastStatusFingerprint = '';
      this.isRefreshing = false;
      if (wasRepo || force) {
        this.notify();
      }
      return this.state;
    }

    // 1. Check if workspace is inside a git work tree
    const checkRepo = await this.runGitCommand('rev-parse --is-inside-work-tree');
    if (checkRepo.exitCode !== 0 || !checkRepo.stdout.toLowerCase().includes('true')) {
      const wasRepo = this.state.isRepo;
      this.state = {
        isRepo: false,
        branch: '',
        stagedChanges: [],
        workingChanges: [],
        totalChanges: 0
      };
      this.fileStatusMap.clear();
      this.folderChangesMap.clear();
      this.lastStatusFingerprint = '';
      this.isRefreshing = false;
      if (wasRepo || force) {
        this.notify();
      }
      return this.state;
    }

    // 2. Query current branch
    const branchRes = await this.runGitCommand('branch --show-current');
    let currentBranch = branchRes.stdout.trim();
    if (!currentBranch) {
      // Check for detached HEAD
      const headRes = await this.runGitCommand('rev-parse --short HEAD');
      currentBranch = headRes.stdout.trim() ? `HEAD (${headRes.stdout.trim()})` : 'main';
    }

    // 3. Query porcelain status with -uall for granular untracked file paths
    const statusRes = await this.runGitCommand('status --porcelain -uall');

    // Create a fingerprint of the status to detect real changes
    const currentFingerprint = `${currentBranch}::${statusRes.stdout}`;
    const hasChanged = currentFingerprint !== this.lastStatusFingerprint || !this.state.isRepo;

    if (hasChanged || force) {
      this.lastStatusFingerprint = currentFingerprint;
      this.parseStatusOutput(statusRes.stdout, ws);
      this.state.isRepo = true;
      this.state.branch = currentBranch;
      this.state.totalChanges = this.state.stagedChanges.length + this.state.workingChanges.length;

      this.isRefreshing = false;
      this.notify();
    } else {
      this.isRefreshing = false;
    }

    return this.state;
  }

  private parseStatusOutput(stdout: string, ws: string) {
    const stagedList: GitFileChange[] = [];
    const workingList: GitFileChange[] = [];
    const newStatusMap = new Map<string, GitFileChange>();
    const folderChangedFiles = new Map<string, Set<string>>();

    const normalizedWs = ws.replace(/\\/g, '/').replace(/\/$/, '');
    const lines = stdout.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      if (line.length < 3) continue;
      const indexCode = line[0];
      const workCode = line[1];
      let rawPath = line.substring(3).trim();

      // Handle renames: "old -> new"
      if (rawPath.includes(' -> ')) {
        const parts = rawPath.split(' -> ');
        rawPath = parts[1].trim();
      }

      // Strip surrounding quotes if path has spaces
      const relPath = rawPath.replace(/^"/, '').replace(/"$/, '').replace(/\\/g, '/');
      const fullPath = `${normalizedWs}/${relPath}`.replace(/\//g, '\\');

      // 1. Check for Staged Change (indexCode !== ' ' and !== '?')
      if (indexCode !== ' ' && indexCode !== '?') {
        let stagedStatus: 'M' | 'U' | 'D' | 'A' | 'R' = 'M';
        if (indexCode === 'A') stagedStatus = 'A';
        else if (indexCode === 'D') stagedStatus = 'D';
        else if (indexCode === 'R') stagedStatus = 'R';
        else stagedStatus = 'M';

        const item: GitFileChange = {
          path: fullPath,
          relativePath: relPath,
          status: stagedStatus,
          isStaged: true
        };
        stagedList.push(item);
        newStatusMap.set(relPath, item);
        newStatusMap.set(relPath.toLowerCase(), item);
        newStatusMap.set(fullPath.replace(/\\/g, '/').toLowerCase(), item);
      }

      // 2. Check for Working Tree Change (workCode !== ' ' or '??')
      if (workCode !== ' ' || indexCode === '?') {
        let workStatus: 'M' | 'U' | 'D' | 'A' | 'R' = 'M';
        if (indexCode === '?' || workCode === '?') workStatus = 'U';
        else if (workCode === 'D') workStatus = 'D';
        else if (workCode === 'A') workStatus = 'A';
        else workStatus = 'M';

        const item: GitFileChange = {
          path: fullPath,
          relativePath: relPath,
          status: workStatus,
          isStaged: false
        };
        workingList.push(item);
        // Working changes take visual precedence on file tree labels
        newStatusMap.set(relPath, item);
        newStatusMap.set(relPath.toLowerCase(), item);
        newStatusMap.set(fullPath.replace(/\\/g, '/').toLowerCase(), item);
      }

      // Record for folder bubble-up
      const pathParts = relPath.split('/');
      pathParts.pop(); // Remove file name
      let currentDir = '';
      for (const part of pathParts) {
        currentDir = currentDir ? `${currentDir}/${part}` : part;
        const normalizedDir = currentDir.toLowerCase();
        if (!folderChangedFiles.has(normalizedDir)) {
          folderChangedFiles.set(normalizedDir, new Set());
        }
        folderChangedFiles.get(normalizedDir)!.add(relPath);
      }
    }

    this.state.stagedChanges = stagedList;
    this.state.workingChanges = workingList;
    this.fileStatusMap = newStatusMap;

    // Convert folder sets to counts
    const newFolderCounts = new Map<string, number>();
    folderChangedFiles.forEach((fileSet, dir) => {
      newFolderCounts.set(dir, fileSet.size);
    });
    this.folderChangesMap = newFolderCounts;
  }

  /**
   * Look up Git status for a given file path (relative or absolute)
   */
  public getFileStatus(filePath: string): GitFileChange | undefined {
    const ws = fsService.getWorkspace();
    let normalized = filePath.replace(/\\/g, '/');
    if (ws) {
      const normalizedWs = ws.replace(/\\/g, '/').replace(/\/$/, '');
      if (normalized.toLowerCase().startsWith(normalizedWs.toLowerCase() + '/')) {
        normalized = normalized.slice(normalizedWs.length + 1);
      }
    }
    return this.fileStatusMap.get(normalized) || this.fileStatusMap.get(normalized.toLowerCase());
  }

  /**
   * Return number of modified/untracked files inside a folder (for folder bubble-up dots)
   */
  public getFolderChangeCount(folderPath: string): number {
    const ws = fsService.getWorkspace();
    let normalized = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
    if (ws) {
      const normalizedWs = ws.replace(/\\/g, '/').replace(/\/$/, '');
      if (normalized.toLowerCase().startsWith(normalizedWs.toLowerCase() + '/')) {
        normalized = normalized.slice(normalizedWs.length + 1);
      } else if (normalized.toLowerCase() === normalizedWs.toLowerCase()) {
        normalized = '';
      }
    }
    if (!normalized) return this.state.totalChanges;
    return this.folderChangesMap.get(normalized.toLowerCase()) || 0;
  }

  /**
   * Stage a specific file
   */
  public async stageFile(relPath: string): Promise<boolean> {
    const res = await this.runGitCommand(`add -- "${relPath}"`);
    await this.refresh();
    return res.exitCode === 0;
  }

  /**
   * Unstage a specific file
   */
  public async unstageFile(relPath: string): Promise<boolean> {
    // Try restore --staged first, fallback to reset HEAD
    let res = await this.runGitCommand(`restore --staged -- "${relPath}"`);
    if (res.exitCode !== 0) {
      res = await this.runGitCommand(`reset HEAD -- "${relPath}"`);
    }
    await this.refresh();
    return res.exitCode === 0;
  }

  /**
   * Stage all changes
   */
  public async stageAll(): Promise<boolean> {
    const res = await this.runGitCommand('add -A');
    await this.refresh();
    return res.exitCode === 0;
  }

  /**
   * Unstage all changes
   */
  public async unstageAll(): Promise<boolean> {
    let res = await this.runGitCommand('restore --staged .');
    if (res.exitCode !== 0) {
      res = await this.runGitCommand('reset HEAD');
    }
    await this.refresh();
    return res.exitCode === 0;
  }

  /**
   * Discard changes to a specific file
   */
  public async discardFile(relPath: string, isUntracked: boolean): Promise<boolean> {
    let res: { exitCode: number };
    if (isUntracked) {
      res = await this.runGitCommand(`clean -f -d -- "${relPath}"`);
    } else {
      res = await this.runGitCommand(`checkout -- "${relPath}"`);
    }
    await this.refresh();
    return res.exitCode === 0;
  }

  /**
   * Discard all working tree changes
   */
  public async discardAll(): Promise<boolean> {
    const res1 = await this.runGitCommand('checkout -- .');
    const res2 = await this.runGitCommand('clean -fd');
    await this.refresh();
    return res1.exitCode === 0 && res2.exitCode === 0;
  }

  /**
   * Commit changes
   */
  public async commit(message: string): Promise<{ success: boolean; error?: string }> {
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      return { success: false, error: 'Commit message cannot be empty' };
    }

    // If nothing is staged, automatically stage all modified & untracked files
    if (this.state.stagedChanges.length === 0) {
      if (this.state.workingChanges.length === 0) {
        return { success: false, error: 'No changes to commit' };
      }
      const stageRes = await this.runGitCommand('add -A');
      if (stageRes.exitCode !== 0) {
        return { success: false, error: `Failed to stage changes: ${stageRes.stderr}` };
      }
    }

    const safeMsg = cleanMsg.replace(/"/g, '\\"');
    const commitRes = await this.runGitCommand(`commit -m "${safeMsg}"`);
    await this.refresh();

    if (commitRes.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: commitRes.stderr || commitRes.stdout };
  }

  /**
   * Push changes to remote
   */
  public async push(): Promise<{ success: boolean; error?: string; output?: string }> {
    const pushRes = await this.runGitCommand('push');
    await this.refresh();
    if (pushRes.exitCode === 0) {
      return { success: true, output: pushRes.stdout || 'Push successful' };
    }
    return { success: false, error: pushRes.stderr || pushRes.stdout };
  }

  /**
   * Pull changes from remote
   */
  public async pull(): Promise<{ success: boolean; error?: string; output?: string }> {
    const pullRes = await this.runGitCommand('pull');
    await this.refresh();
    if (pullRes.exitCode === 0) {
      return { success: true, output: pullRes.stdout || 'Pull successful' };
    }
    return { success: false, error: pullRes.stderr || pullRes.stdout };
  }

  /**
   * Fetch list of local branches
   */
  public async getBranches(): Promise<GitBranch[]> {
    const res = await this.runGitCommand('branch --list --no-color');
    if (res.exitCode !== 0) return [];

    const branches: GitBranch[] = [];
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const isCurrent = line.startsWith('*');
      const name = line.replace('*', '').trim();
      if (name) {
        branches.push({ name, isCurrent });
      }
    }
    return branches;
  }

  /**
   * Switch to an existing branch
   */
  public async checkoutBranch(branchName: string): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`checkout "${branchName}"`);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Create and checkout a new branch
   */
  public async createAndCheckoutBranch(branchName: string): Promise<{ success: boolean; error?: string }> {
    const cleanName = branchName.trim().replace(/\s+/g, '-');
    const res = await this.runGitCommand(`checkout -b "${cleanName}"`);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Retrieve diff for a changed file
   */
  public async getFileDiff(relPath: string, staged: boolean = false): Promise<{ diff: string; isNew: boolean }> {
    const status = this.getFileStatus(relPath);
    const isUntracked = status?.status === 'U';

    if (isUntracked) {
      // For untracked new files, read content and format as unified diff of additions
      try {
        const ws = fsService.getWorkspace();
        const fullPath = `${ws}/${relPath}`;
        const content = await fsService.readFile(fullPath);
        const lines = content.split(/\r?\n/);
        let diffText = `--- /dev/null\n+++ b/${relPath}\n@@ -0,0 +1,${lines.length} @@\n`;
        for (const l of lines) {
          diffText += `+${l}\n`;
        }
        return { diff: diffText, isNew: true };
      } catch (e) {
        return { diff: 'Untracked file (unable to read content)', isNew: true };
      }
    }

    const flag = staged ? '--cached' : '';
    const res = await this.runGitCommand(`diff ${flag} -- "${relPath}"`);
    return { diff: res.stdout || 'No differences detected', isNew: false };
  }

  /**
   * Initialize a new Git repository
   */
  public async initRepo(): Promise<boolean> {
    const res = await this.runGitCommand('init', false);
    await this.refresh();
    return res.exitCode === 0;
  }

  /**
   * Fetch topologically sorted commit history
   */
  public async getCommitLog(options?: {
    maxCount?: number;
    skip?: number;
    all?: boolean;
    branch?: string;
    search?: string;
    includeReflog?: boolean;
    onlyDangling?: boolean;
  }): Promise<GitCommit[]> {
    const max = options?.maxCount ?? 50;
    const skip = options?.skip ?? 0;
    const isAll = options?.all !== false && !options?.branch;
    let branchArg = '';
    if (options?.onlyDangling) {
      branchArg = '--reflog --not --all';
    } else if (options?.branch && options.branch !== 'all') {
      branchArg = `"${options.branch}"`;
    } else if (isAll) {
      branchArg = '--all';
    }

    const danglingSet = new Set<string>();
    if (options?.includeReflog || options?.onlyDangling) {
      if (!options?.onlyDangling) {
        branchArg += ' --reflog';
      }
      // Query reflog unreachable and fsck lost-found
      const resDangling = await this.runGitCommand('log --reflog --not --all --format="%H"', true);
      if (resDangling.exitCode === 0) {
        resDangling.stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .forEach((h) => danglingSet.add(h.trim()));
      }
      const lostFound = await this.getDanglingCommitHashes();
      lostFound.forEach((h) => danglingSet.add(h));
      if (lostFound.length > 0 && !options?.onlyDangling) {
        branchArg += ` ${lostFound.slice(0, 20).join(' ')}`;
      }
    }

    let grepArg = '';
    if (options?.search?.trim()) {
      grepArg = `--grep="${options.search.trim().replace(/"/g, '\\"')}" -i`;
    }

    const cmd = `log ${branchArg} ${grepArg} --date-order --format="%H|%P|%an|%ae|%at|%s|%D" -n ${max} --skip ${skip}`;
    const res = await this.runGitCommand(cmd, true);
    if (res.exitCode !== 0 || !res.stdout.trim()) {
      return [];
    }

    const commits: GitCommit[] = [];
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 6) continue;

      const hash = parts[0].trim();
      const parentsStr = parts[1].trim();
      const authorName = parts[2].trim();
      const authorEmail = parts[3].trim();
      const timestamp = parseInt(parts[4].trim(), 10) || Math.floor(Date.now() / 1000);
      const message = parts[5].trim();
      const refsStr = parts.slice(6).join('|').trim();

      const parentHashes = parentsStr ? parentsStr.split(/\s+/).filter(Boolean) : [];
      const refs = this.parseRefs(refsStr);
      const isDangling = danglingSet.has(hash);
      if (isDangling) {
        refs.push({
          name: 'abandoned',
          type: 'dangling'
        });
      }

      commits.push({
        hash,
        shortHash: hash.slice(0, 7),
        parentHashes,
        authorName,
        authorEmail,
        timestamp,
        relativeDate: this.formatRelativeTime(timestamp),
        message,
        refs,
        isDangling
      });
    }

    return commits;
  }

  /**
   * Retrieve dangling commit hashes from git fsck
   */
  public async getDanglingCommitHashes(): Promise<string[]> {
    const res = await this.runGitCommand('fsck --lost-found', true);
    if (res.exitCode !== 0) return [];
    const hashes: string[] = [];
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    for (const l of lines) {
      if (l.includes('dangling commit')) {
        const h = l.replace(/.*dangling commit\s+([0-9a-f]+).*/i, '$1').trim();
        if (h) hashes.push(h);
      }
    }
    return hashes;
  }

  /**
   * Restore an abandoned or dangling commit by creating a new branch pointing to it
   */
  public async restoreCommitToBranch(hash: string, branchName: string): Promise<{ success: boolean; error?: string }> {
    const clean = branchName.trim().replace(/\s+/g, '-');
    const res = await this.runGitCommand(`branch "${clean}" ${hash}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  private parseRefs(refsStr: string): GitRef[] {
    if (!refsStr) return [];
    const parts = refsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const result: GitRef[] = [];

    for (const p of parts) {
      if (p.startsWith('HEAD -> ')) {
        result.push({
          name: p.replace('HEAD -> ', '').trim(),
          type: 'head',
          isCurrentHead: true
        });
      } else if (p === 'HEAD') {
        result.push({
          name: 'HEAD',
          type: 'head',
          isCurrentHead: true
        });
      } else if (p.startsWith('tag: ')) {
        result.push({
          name: p.replace('tag: ', '').trim(),
          type: 'tag'
        });
      } else if (p.startsWith('refs/tags/')) {
        result.push({
          name: p.replace('refs/tags/', '').trim(),
          type: 'tag'
        });
      } else if (p.includes('/') || p.startsWith('origin/')) {
        result.push({
          name: p,
          type: 'remote'
        });
      } else {
        result.push({
          name: p,
          type: 'branch'
        });
      }
    }
    return result;
  }

  public formatRelativeTime(timestampSec: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - timestampSec);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
  }

  /**
   * Retrieve full details for a commit, including changed files and stat counts
   */
  public async getCommitDetails(hash: string): Promise<GitCommitDetail | null> {
    const resHeader = await this.runGitCommand(`show -s --format="%H|%P|%an|%ae|%at|%s|%B%x1f" ${hash}`, true);
    if (resHeader.exitCode !== 0) return null;

    const raw = resHeader.stdout.split('\x1f')[0] || resHeader.stdout;
    const parts = raw.split('|');
    if (parts.length < 6) return null;

    const fullHash = parts[0].trim();
    const parents = parts[1].trim() ? parts[1].trim().split(/\s+/) : [];
    const authorName = parts[2].trim();
    const authorEmail = parts[3].trim();
    const timestamp = parseInt(parts[4].trim(), 10) || 0;
    const message = parts[5].trim();
    const body = parts.slice(6).join('|').trim();

    const resFiles = await this.runGitCommand(`show --numstat --format="" ${hash}`, true);
    const files: GitCommitFile[] = [];

    const lines = resFiles.stdout.split(/\r?\n/).filter(Boolean);
    for (const l of lines) {
      const fParts = l.split('\t');
      if (fParts.length >= 3) {
        const adds = fParts[0] === '-' ? 0 : parseInt(fParts[0], 10) || 0;
        const dels = fParts[1] === '-' ? 0 : parseInt(fParts[1], 10) || 0;
        const filePath = fParts[2].trim();
        files.push({
          path: filePath,
          status: 'M',
          additions: adds,
          deletions: dels
        });
      }
    }

    const resStatus = await this.runGitCommand(`diff-tree --no-commit-id --name-status -r ${hash}`, true);
    const statusLines = resStatus.stdout.split(/\r?\n/).filter(Boolean);
    for (const sl of statusLines) {
      const tokens = sl.split(/\t+/);
      if (tokens.length >= 2) {
        const rawStat = tokens[0].trim()[0] as 'M' | 'A' | 'D' | 'R' | 'U';
        const p = tokens[tokens.length - 1].trim();
        const f = files.find((item) => item.path === p);
        if (f) {
          f.status = rawStat || 'M';
        } else {
          files.push({ path: p, status: rawStat || 'M' });
        }
      }
    }

    return {
      hash: fullHash,
      shortHash: fullHash.slice(0, 7),
      parentHashes: parents,
      authorName,
      authorEmail,
      timestamp,
      relativeDate: this.formatRelativeTime(timestamp),
      message,
      body,
      refs: [],
      files
    };
  }

  /**
   * Retrieve diff for a specific file in a specific commit
   */
  public async getCommitFileDiff(hash: string, filePath: string, parentHash?: string): Promise<string> {
    const parent = parentHash || `${hash}^`;
    const res = await this.runGitCommand(`diff ${parent} ${hash} -- "${filePath}"`, true);
    if (res.exitCode === 0) {
      return res.stdout || 'No textual differences detected.';
    }
    const showRes = await this.runGitCommand(`show ${hash} -- "${filePath}"`, true);
    return showRes.stdout || 'No diff available.';
  }

  /**
   * Fetch from remote repository
   */
  public async fetch(remote?: string): Promise<{ success: boolean; error?: string; output?: string }> {
    const res = await this.runGitCommand(`fetch ${remote || ''}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true, output: res.stdout || 'Fetch completed' };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Amend previous commit
   */
  public async commitAmend(message?: string): Promise<{ success: boolean; error?: string }> {
    const msgArg = message ? `-m "${message.replace(/"/g, '\\"')}"` : '--no-edit';
    const res = await this.runGitCommand(`commit --amend ${msgArg}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Stash changes
   */
  public async stash(includeUntracked: boolean = false, message?: string): Promise<{ success: boolean; error?: string }> {
    const uArg = includeUntracked ? '-u' : '';
    const mArg = message ? `-m "${message.replace(/"/g, '\\"')}"` : '';
    const res = await this.runGitCommand(`stash push ${uArg} ${mArg}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Pop latest stash
   */
  public async stashPop(): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand('stash pop', false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Apply latest stash without dropping
   */
  public async stashApply(): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand('stash apply', false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Drop a stash
   */
  public async stashDrop(index: number = 0): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`stash drop stash@{${index}}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Get list of stashes
   */
  public async getStashList(): Promise<string[]> {
    const res = await this.runGitCommand('stash list', true);
    if (res.exitCode !== 0) return [];
    return res.stdout.split(/\r?\n/).filter(Boolean);
  }

  /**
   * Create a new branch
   */
  public async createBranch(branchName: string, startPoint?: string): Promise<{ success: boolean; error?: string }> {
    const cleanName = branchName.trim().replace(/\s+/g, '-');
    const start = startPoint ? ` "${startPoint}"` : '';
    const res = await this.runGitCommand(`branch "${cleanName}"${start}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Delete a branch
   */
  public async deleteBranch(branchName: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
    const flag = force ? '-D' : '-d';
    const res = await this.runGitCommand(`branch ${flag} "${branchName}"`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Rename a branch
   */
  public async renameBranch(oldName: string, newName: string): Promise<{ success: boolean; error?: string }> {
    const cleanNew = newName.trim().replace(/\s+/g, '-');
    const res = await this.runGitCommand(`branch -m "${oldName}" "${cleanNew}"`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Merge a branch into the current HEAD
   */
  public async mergeBranch(branchName: string): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`merge "${branchName}"`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Create a tag
   */
  public async createTag(tagName: string, message?: string): Promise<{ success: boolean; error?: string }> {
    const cleanTag = tagName.trim();
    const msgArg = message ? `-a -m "${message.replace(/"/g, '\\"')}"` : '';
    const res = await this.runGitCommand(`tag ${cleanTag} ${msgArg}`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Delete a tag
   */
  public async deleteTag(tagName: string): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`tag -d "${tagName}"`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Retrieve list of tags
   */
  public async getTags(): Promise<string[]> {
    const res = await this.runGitCommand('tag -l --sort=-creatordate', true);
    if (res.exitCode !== 0) return [];
    return res.stdout.split(/\r?\n/).filter(Boolean);
  }

  /**
   * Retrieve list of remotes
   */
  public async getRemotes(): Promise<{ name: string; url: string }[]> {
    const res = await this.runGitCommand('remote -v', true);
    if (res.exitCode !== 0) return [];
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    const remotesMap = new Map<string, string>();
    for (const l of lines) {
      const parts = l.split(/\s+/);
      if (parts.length >= 2) {
        remotesMap.set(parts[0], parts[1]);
      }
    }
    const remotes: { name: string; url: string }[] = [];
    remotesMap.forEach((url, name) => remotes.push({ name, url }));
    return remotes;
  }

  /**
   * Add a remote
   */
  public async addRemote(name: string, url: string): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`remote add "${name.trim()}" "${url.trim()}"`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Remove a remote
   */
  public async removeRemote(name: string): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`remote remove "${name.trim()}"`, false);
    await this.refresh();
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }

  /**
   * Clone a repository
   */
  public async clone(url: string, targetDir: string): Promise<{ success: boolean; error?: string }> {
    const res = await this.runGitCommand(`clone "${url.trim()}" "${targetDir.trim()}"`, false);
    if (res.exitCode === 0) {
      return { success: true };
    }
    return { success: false, error: res.stderr || res.stdout };
  }
}

export const gitService = new GitService();
