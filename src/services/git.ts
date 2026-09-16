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

export interface GitState {
  isRepo: boolean;
  branch: string;
  stagedChanges: GitFileChange[];
  workingChanges: GitFileChange[];
  totalChanges: number;
}

export type GitStatusChangeListener = (state: GitState) => void;

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
  private isRefreshing: boolean = false;

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

  public async runGitCommand(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!isNative()) {
      return { stdout: '', stderr: 'Git not supported in web mode', exitCode: 1 };
    }

    const ws = fsService.getWorkspace();
    if (!ws) {
      return { stdout: '', stderr: 'No workspace folder open', exitCode: 1 };
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

  public async refresh(): Promise<GitState> {
    if (this.isRefreshing) return this.state;
    this.isRefreshing = true;

    const ws = fsService.getWorkspace();
    if (!ws) {
      this.state = {
        isRepo: false,
        branch: '',
        stagedChanges: [],
        workingChanges: [],
        totalChanges: 0
      };
      this.fileStatusMap.clear();
      this.folderChangesMap.clear();
      this.isRefreshing = false;
      this.notify();
      return this.state;
    }

    // 1. Check if workspace is inside a git work tree
    const checkRepo = await this.runGitCommand('rev-parse --is-inside-work-tree');
    if (checkRepo.exitCode !== 0 || !checkRepo.stdout.toLowerCase().includes('true')) {
      this.state = {
        isRepo: false,
        branch: '',
        stagedChanges: [],
        workingChanges: [],
        totalChanges: 0
      };
      this.fileStatusMap.clear();
      this.folderChangesMap.clear();
      this.isRefreshing = false;
      this.notify();
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
    this.parseStatusOutput(statusRes.stdout, ws);

    this.state.isRepo = true;
    this.state.branch = currentBranch;
    this.state.totalChanges = this.state.stagedChanges.length + this.state.workingChanges.length;

    this.isRefreshing = false;
    this.notify();
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
    const res = await this.runGitCommand('init');
    await this.refresh();
    return res.exitCode === 0;
  }
}

export const gitService = new GitService();
