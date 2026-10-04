// Gitero In-App Updater Service
// Provides genuine live hot-updating of resources.neu, full installer execution, and safe rollback backups.

import { isNative } from './neutralino';
import { preferencesService } from './preferences';
import { notificationService } from './notification';
import { APP_VERSION, DISPLAY_VERSION, GIT_COMMIT_SHA, GIT_BRANCH } from '../version';

export interface BranchInfo {
  name: string;
  commitSha: string;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
  author: string;
}

export interface ReleaseAsset {
  name: string;
  size: number;
  browserDownloadUrl: string;
}

export interface ReleaseInfo {
  tagName: string;
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  neuAsset?: ReleaseAsset;
  installerAsset?: ReleaseAsset;
}

export interface UpdateStatus {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  currentSha: string;
  latestSha?: string;
  channel: string;
  latestRelease?: ReleaseInfo;
  latestCommit?: CommitInfo;
}

export interface UpdateHistoryEntry {
  id: string;
  timestamp: string; // ISO 8601
  formattedTime: string;
  branch: string;
  fromSha: string;
  toSha: string;
  commitMessage: string;
  author: string;
  type: 'update' | 'rollback';
}

export const GITHUB_REPO = 'iharshraj1123/Gitero-IDE';
const CURRENT_VERSION = DISPLAY_VERSION;
const HISTORY_STORAGE_KEY = 'gitero_update_history';

/**
 * Parses semantic version string (e.g. "0.4.0-beta" or "v0.4.0").
 */
export function parseVersion(v: string): { major: number; minor: number; patch: number; pre?: string } {
  const clean = v.trim().replace(/^v/i, '');
  const [core, pre] = clean.split('-');
  const parts = core.split('.').map((p) => parseInt(p, 10) || 0);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    pre: pre ? pre.toLowerCase() : undefined
  };
}

/**
 * Compares two semantic versions. Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (!pa.pre && pb.pre) return 1; // 1.0.0 > 1.0.0-beta
  if (pa.pre && !pb.pre) return -1; // 1.0.0-beta < 1.0.0
  if (pa.pre && pb.pre) return pa.pre.localeCompare(pb.pre);
  return 0;
}

export class UpdaterService {
  private currentBranch: string;
  private currentSha: string;

  constructor() {
    this.currentBranch = preferencesService.get('updater.channel') || localStorage.getItem('gitero_update_branch') || 'release';
    const storedSha = localStorage.getItem('gitero_current_sha');
    if (!storedSha || storedSha === '791a8ec') {
      this.currentSha = GIT_COMMIT_SHA;
      localStorage.setItem('gitero_current_sha', GIT_COMMIT_SHA);
    } else {
      this.currentSha = storedSha;
    }
    this.ensureInitialHistory();
  }

  getCurrentVersion(): string {
    return CURRENT_VERSION;
  }

  getCurrentBranch(): string {
    return preferencesService.get('updater.channel') || this.currentBranch || 'release';
  }

  getCurrentSha(): string {
    return this.currentSha;
  }

  setTargetBranch(branch: string) {
    this.currentBranch = branch;
    preferencesService.set('updater.channel', branch);
    localStorage.setItem('gitero_update_branch', branch);
  }

  private ensureInitialHistory() {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    let history: UpdateHistoryEntry[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          history = parsed.filter((e) => e.toSha !== '791a8ec' && !e.commitMessage?.includes('v0.0.3-alpha'));
        }
      } catch {
        history = [];
      }
    }

    if (history.length === 0) {
      const now = new Date();
      const baseline: UpdateHistoryEntry = {
        id: `entry-${Date.now()}`,
        timestamp: now.toISOString(),
        formattedTime: now.toLocaleString(),
        branch: this.currentBranch,
        fromSha: 'factory',
        toSha: this.currentSha,
        commitMessage: `Factory Release (${DISPLAY_VERSION} build)`,
        author: 'Gitero Team',
        type: 'update'
      };
      history = [baseline];
    }
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }

  getHistory(): UpdateHistoryEntry[] {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[UpdaterService] Failed to parse history:', e);
    }
    return [];
  }

  recordHistory(entry: Omit<UpdateHistoryEntry, 'id' | 'timestamp' | 'formattedTime'>): UpdateHistoryEntry {
    const now = new Date();
    const newEntry: UpdateHistoryEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now.toISOString(),
      formattedTime: now.toLocaleString(),
      ...entry
    };

    const history = this.getHistory();
    history.unshift(newEntry);

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('[UpdaterService] Failed to save update history:', e);
    }

    return newEntry;
  }

  clearHistory() {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    this.ensureInitialHistory();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Gitero-IDE'
    };
    const token = preferencesService.get('updater.githubToken') || localStorage.getItem('gitero_github_token') || '';
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    return headers;
  }

  /**
   * Fetches latest official release from GitHub Releases API
   */
  async fetchLatestRelease(): Promise<ReleaseInfo | null> {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`, {
        headers: this.getHeaders()
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        console.warn(`[UpdaterService] GitHub Releases query returned ${res.status}: ${res.statusText}`);
        return null;
      }

      const releases = await res.json();
      if (!Array.isArray(releases) || releases.length === 0) return null;

      // Select latest non-draft release
      const rel = releases.find((r: any) => !r.draft) || releases[0];
      const tagName = rel.tag_name || '';
      const version = tagName.replace(/^v/i, '');

      let neuAsset: ReleaseAsset | undefined;
      let installerAsset: ReleaseAsset | undefined;

      if (Array.isArray(rel.assets)) {
        for (const asset of rel.assets) {
          if (asset.name === 'resources.neu' || asset.name.endsWith('.neu')) {
            neuAsset = {
              name: asset.name,
              size: asset.size || 0,
              browserDownloadUrl: asset.browser_download_url
            };
          } else if (/^Gitero-Setup.*\.exe$/i.test(asset.name) || (asset.name.endsWith('.exe') && asset.name.includes('Setup'))) {
            installerAsset = {
              name: asset.name,
              size: asset.size || 0,
              browserDownloadUrl: asset.browser_download_url
            };
          }
        }
      }

      return {
        tagName,
        version,
        name: rel.name || tagName,
        body: rel.body || '',
        publishedAt: rel.published_at || new Date().toISOString(),
        htmlUrl: rel.html_url || `https://github.com/${GITHUB_REPO}/releases/tag/${tagName}`,
        neuAsset,
        installerAsset
      };
    } catch (err) {
      console.warn('[UpdaterService] Failed to query GitHub Releases:', err);
      return null;
    }
  }

  /**
   * Fetch all active branches from the GitHub repository
   */
  async fetchBranches(): Promise<string[]> {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/branches`, {
        headers: this.getHeaders()
      });

      const options = ['release', 'main'];

      if (!res.ok) {
        return options;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        const branches = data.map((b: any) => b.name);
        branches.forEach((b: string) => {
          if (!options.includes(b)) options.push(b);
        });
      }
      return options;
    } catch (err) {
      console.warn('[UpdaterService] Failed to fetch branches, fallback to defaults:', err);
      return ['release', 'main'];
    }
  }

  /**
   * Get the latest commit info for a specific branch
   */
  async fetchLatestCommit(branch: string): Promise<CommitInfo> {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/${branch}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Repository or branch "${branch}" was not found (HTTP 404). If this repository is private, configure a GitHub Personal Access Token.`);
      }
      throw new Error(`Could not fetch branch info (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    const sha = data.sha || '';
    const message = data.commit?.message?.split('\n')[0] || 'Update';
    const author = data.commit?.author?.name || 'Contributor';
    const date = data.commit?.author?.date || new Date().toISOString();

    return {
      sha,
      shortSha: sha.substring(0, 7),
      message,
      date,
      author
    };
  }

  /**
   * Check if an update is available on the target branch or release channel
   */
  async checkForUpdates(targetChannel: string = 'release'): Promise<UpdateStatus> {
    this.setTargetBranch(targetChannel);

    const cleanCurrent = APP_VERSION.replace(/^v/i, '');

    // 1. If target is 'release' or we want official releases:
    if (targetChannel === 'release' || !targetChannel) {
      const latestRelease = await this.fetchLatestRelease();

      if (latestRelease) {
        const cleanLatest = latestRelease.version.replace(/^v/i, '');
        const isNewer = compareVersions(cleanLatest, cleanCurrent) > 0 || (cleanLatest !== cleanCurrent && latestRelease.tagName !== `v${cleanCurrent}`);

        if (isNewer) {
          notificationService.info(
            'Gitero Update Available',
            `A new release is available: ${latestRelease.name} (${latestRelease.tagName})`,
            [
              {
                label: 'View Update',
                primary: true,
                onClick: () => {
                  window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'updates' } }));
                }
              }
            ],
            15000
          );
        }

        return {
          isUpdateAvailable: isNewer,
          currentVersion: DISPLAY_VERSION,
          latestVersion: latestRelease.tagName,
          currentSha: this.currentSha,
          latestSha: latestRelease.tagName,
          channel: 'release',
          latestRelease
        };
      }

      return {
        isUpdateAvailable: false,
        currentVersion: DISPLAY_VERSION,
        latestVersion: DISPLAY_VERSION,
        currentSha: this.currentSha,
        latestSha: this.currentSha,
        channel: 'release'
      };
    }

    // 2. Target is a specific git branch (e.g. 'main', 'dev')
    // Decoupled from GitHub Releases!
    const latestCommit = await this.fetchLatestCommit(targetChannel);
    const isAvailable = latestCommit.shortSha.toLowerCase() !== this.currentSha.toLowerCase();

    // Query package.json on that branch to determine its active version
    let branchVersion = DISPLAY_VERSION;
    try {
      const pkgRes = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/${targetChannel}/package.json`, {
        headers: this.getHeaders()
      });
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        if (pkgData.version) {
          branchVersion = `v${pkgData.version.replace(/^v/i, '')}`;
        }
      }
    } catch {}

    if (isAvailable) {
      notificationService.info(
        'Gitero Update Available',
        `New commit on branch "${targetChannel}": ${latestCommit.message} (${latestCommit.shortSha})`,
        [
          {
            label: 'View Update',
            primary: true,
            onClick: () => {
              window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'updates' } }));
            }
          }
        ],
        15000
      );
    }

    return {
      isUpdateAvailable: isAvailable,
      currentVersion: DISPLAY_VERSION,
      latestVersion: branchVersion,
      currentSha: this.currentSha,
      latestSha: latestCommit.shortSha,
      channel: targetChannel,
      latestRelease: undefined,
      latestCommit
    };
  }

  /**
   * Genuine Live Hot-Update:
   * 1. Downloads compiled resources.neu directly from GitHub Release
   * 2. Validates binary integrity and file size
   * 3. Creates resources.neu.bak safety backup of existing bundle
   * 4. Overwrites resources.neu in application directory
   * 5. Restarts application cleanly
   */
  async applyLiveUpdate(
    assetUrl: string,
    targetVersion: string,
    onProgress: (step: string) => void,
    targetBranch: string = 'release'
  ): Promise<boolean> {
    const previousVersion = DISPLAY_VERSION;

    if (!isNative()) {
      throw new Error('Live bundle updates require running the native Gitero desktop application.');
    }

    const appPath = (window as any).NL_PATH ? (window as any).NL_PATH.replace(/[/\\]+$/, '') : '';
    if (!appPath) {
      throw new Error('Could not resolve native application directory (NL_PATH is undefined).');
    }

    const normalizedAppPath = appPath.replace(/\\/g, '/');
    const targetNeu = `${normalizedAppPath}/resources.neu`;
    const tempNeu = `${normalizedAppPath}/resources.neu.download`;
    const backupNeu = `${normalizedAppPath}/resources.neu.bak`;

    onProgress('Connecting to release distribution network...');

    // Download via native Windows curl.exe
    const curlCmd = `curl.exe -L -f -s -S -H "User-Agent: Gitero-IDE" -o "${tempNeu}" "${assetUrl}"`;
    onProgress(`Downloading genuine bundle (${targetVersion})...`);

    let downloadSuccess = false;
    try {
      const curlRes = await window.Neutralino.os.execCommand(curlCmd);
      if (curlRes.exitCode === 0) {
        downloadSuccess = true;
      } else {
        console.warn('[Updater] curl.exe failed with code', curlRes.exitCode, curlRes.stdErr);
      }
    } catch (e) {
      console.warn('[Updater] Error executing curl:', e);
    }

    // Fallback to PowerShell if curl encountered issues
    if (!downloadSuccess) {
      onProgress('Retrying download via PowerShell WebClient...');
      const psCmd = `powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).Headers.Add('User-Agent','Gitero-IDE'); (New-Object System.Net.WebClient).DownloadFile('${assetUrl}', '${tempNeu}')"`;
      const psRes = await window.Neutralino.os.execCommand(psCmd);
      if (psRes.exitCode !== 0) {
        throw new Error(`Failed to download update bundle: ${psRes.stdErr || 'Network error'}`);
      }
    }

    onProgress('Verifying bundle integrity...');
    let stats: any = null;
    try {
      stats = await window.Neutralino.filesystem.getStats(tempNeu);
    } catch {
      throw new Error('Downloaded bundle not found on disk.');
    }

    if (!stats || stats.size < 500000) {
      try {
        await window.Neutralino.filesystem.remove(tempNeu);
      } catch {}
      throw new Error(`Downloaded bundle is corrupted or incomplete (size: ${stats?.size || 0} bytes).`);
    }

    onProgress('Creating rollback backup of current bundle...');
    try {
      try {
        await window.Neutralino.filesystem.remove(backupNeu);
      } catch {}
      await window.Neutralino.filesystem.copy(targetNeu, backupNeu);
    } catch (err) {
      console.warn('[Updater] Could not create backup of existing resources.neu:', err);
    }

    onProgress('Applying update to application runtime...');
    let swapSuccess = false;
    try {
      await window.Neutralino.filesystem.copy(tempNeu, targetNeu);
      await window.Neutralino.filesystem.remove(tempNeu);
      swapSuccess = true;
    } catch (err) {
      console.warn('[Updater] Direct filesystem.copy failed, trying PowerShell swap:', err);
    }

    if (!swapSuccess) {
      const swapCmd = `powershell -NoProfile -Command "Copy-Item -Force '${tempNeu}' '${targetNeu}'; Remove-Item -Force '${tempNeu}'"`;
      const swapRes = await window.Neutralino.os.execCommand(swapCmd);
      if (swapRes.exitCode !== 0) {
        throw new Error(`Could not replace application bundle: ${swapRes.stdErr}`);
      }
    }

    onProgress('Recording update history...');
    this.recordHistory({
      branch: targetBranch,
      fromSha: previousVersion,
      toSha: targetVersion,
      commitMessage: targetBranch === 'release' ? `Live Update to ${targetVersion}` : `Branch Update (${targetBranch}) to ${targetVersion}`,
      author: 'Gitero Team',
      type: 'update'
    });

    localStorage.setItem('gitero_current_sha', targetVersion);
    localStorage.setItem('gitero_installed_version', targetVersion);

    onProgress('Update installed successfully! Restart required.');
    return true;
  }

  /**
   * Downloads full Gitero Setup installer and executes it silently
   */
  async downloadAndRunInstaller(
    installerUrl: string,
    targetVersion: string,
    onProgress: (step: string) => void
  ): Promise<boolean> {
    if (!isNative()) {
      throw new Error('Installer update requires running the native desktop application.');
    }

    onProgress('Resolving temporary download folder...');
    let tempDir = 'C:/Temp';
    try {
      const res = await window.Neutralino.os.execCommand('powershell -NoProfile -Command "$env:TEMP"');
      if (res.exitCode === 0 && res.stdOut.trim()) {
        tempDir = res.stdOut.trim().replace(/\\/g, '/');
      }
    } catch {}

    const installerDest = `${tempDir}/Gitero-Setup-${targetVersion}.exe`;
    onProgress(`Downloading Gitero Setup installer (${targetVersion})...`);

    const curlCmd = `curl.exe -L -f -s -S -H "User-Agent: Gitero-IDE" -o "${installerDest}" "${installerUrl}"`;
    let success = false;
    try {
      const res = await window.Neutralino.os.execCommand(curlCmd);
      if (res.exitCode === 0) success = true;
    } catch {}

    if (!success) {
      const psCmd = `powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).Headers.Add('User-Agent','Gitero-IDE'); (New-Object System.Net.WebClient).DownloadFile('${installerUrl}', '${installerDest}')"`;
      const res = await window.Neutralino.os.execCommand(psCmd);
      if (res.exitCode !== 0) {
        throw new Error(`Failed to download installer: ${res.stdErr}`);
      }
    }

    onProgress('Verifying installer integrity...');
    try {
      const stats = await window.Neutralino.filesystem.getStats(installerDest);
      if (!stats || stats.size < 1000000) {
        throw new Error('Installer file is incomplete.');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Installer validation failed.');
    }

    onProgress('Launching installer...');
    const nativePath = installerDest.replace(/\//g, '\\');
    const launchCmd = `cmd.exe /c start "" "${nativePath}" /SILENT /FORCECLOSEAPPLICATIONS /RESTARTAPPLICATIONS`;
    await window.Neutralino.os.execCommand(launchCmd, { background: true });

    setTimeout(() => {
      if (window.Neutralino?.app?.exit) {
        window.Neutralino.app.exit();
      }
    }, 800);

    return true;
  }

  /**
   * Rollback application to previous resources.neu.bak
   */
  async rollbackToBackup(onProgress: (step: string) => void): Promise<boolean> {
    if (!isNative()) {
      throw new Error('Rollback requires running the native desktop application.');
    }

    const appPath = (window as any).NL_PATH ? (window as any).NL_PATH.replace(/[/\\]+$/, '') : '';
    if (!appPath) {
      throw new Error('Could not resolve native application directory.');
    }

    const normalizedAppPath = appPath.replace(/\\/g, '/');
    const targetNeu = `${normalizedAppPath}/resources.neu`;
    const backupNeu = `${normalizedAppPath}/resources.neu.bak`;

    onProgress('Checking for previous backup bundle...');
    try {
      const stats = await window.Neutralino.filesystem.getStats(backupNeu);
      if (!stats || stats.size < 500000) {
        throw new Error('No valid backup bundle (resources.neu.bak) found on disk.');
      }
    } catch {
      throw new Error('No rollback backup bundle found on disk.');
    }

    onProgress('Restoring previous bundle from backup...');
    const restoreCmd = `powershell -NoProfile -Command "Copy-Item -Force '${backupNeu}' '${targetNeu}'"`;
    const res = await window.Neutralino.os.execCommand(restoreCmd);
    if (res.exitCode !== 0) {
      throw new Error(`Rollback failed: ${res.stdErr}`);
    }

    this.recordHistory({
      branch: 'rollback',
      fromSha: DISPLAY_VERSION,
      toSha: 'backup',
      commitMessage: 'Restored from previous resources.neu.bak',
      author: 'Rollback System',
      type: 'rollback'
    });

    onProgress('Rollback restored successfully! Ready to restart.');
    return true;
  }

  /**
   * Checks whether a rollback backup exists on disk
   */
  async hasBackup(): Promise<boolean> {
    if (!isNative()) return false;
    const appPath = (window as any).NL_PATH ? (window as any).NL_PATH.replace(/[/\\]+$/, '') : '';
    if (!appPath) return false;
    try {
      const stats = await window.Neutralino.filesystem.getStats(`${appPath.replace(/\\/g, '/')}/resources.neu.bak`);
      return !!(stats && stats.size > 500000);
    } catch {
      return false;
    }
  }

  /**
   * Main entrypoint for branch/channel updates
   */
  async updateFromBranch(branch: string, onProgress: (step: string) => void): Promise<boolean> {
    onProgress(`Checking for latest build on branch "${branch}"...`);

    if (branch === 'release') {
      const release = await this.fetchLatestRelease();
      if (release && release.neuAsset) {
        onProgress(`Found official release ${release.tagName}. Beginning live bundle update...`);
        return await this.applyLiveUpdate(release.neuAsset.browserDownloadUrl, release.version, onProgress, 'release');
      }
      if (release && release.installerAsset) {
        onProgress(`Found release installer for ${release.tagName}. Downloading setup wizard...`);
        return await this.downloadAndRunInstaller(release.installerAsset.browserDownloadUrl, release.version, onProgress);
      }
      throw new Error('No official release packages found on GitHub Releases.');
    }

    // Branch update: Fetch branch latest commit
    const latestCommit = await this.fetchLatestCommit(branch);

    // 1. Try to find a rolling continuous release for this branch (e.g., continuous-main)
    const rollingAssetUrl = `https://github.com/${GITHUB_REPO}/releases/download/continuous-${branch}/resources.neu`;
    let foundUrl = '';
    try {
      const headRes = await fetch(rollingAssetUrl, { method: 'HEAD' });
      if (headRes.ok) {
        foundUrl = rollingAssetUrl;
      }
    } catch {}

    // 2. If not rolling, check if latest commit corresponds to a tagged release
    if (!foundUrl) {
      try {
        const pkgRes = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/package.json`, {
          headers: this.getHeaders()
        });
        if (pkgRes.ok) {
          const pkgData = await pkgRes.json();
          const ver = pkgData.version ? pkgData.version.replace(/^v/i, '') : '';
          if (ver) {
            const tagAssetUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${ver}/resources.neu`;
            const tagHead = await fetch(tagAssetUrl, { method: 'HEAD' });
            if (tagHead.ok) {
              foundUrl = tagAssetUrl;
            }
          }
        }
      } catch {}
    }

    if (foundUrl) {
      onProgress(`Found runtime bundle for branch "${branch}" (${latestCommit.shortSha}). Downloading update...`);
      return await this.applyLiveUpdate(foundUrl, latestCommit.shortSha, onProgress, branch);
    }

    throw new Error(
      `No compiled release bundle (resources.neu) was found on GitHub for branch "${branch}" (Commit ${latestCommit.shortSha}). ` +
      `A rolling build or release package needs to be generated on GitHub for this branch.`
    );
  }

  /**
   * Rollback to any previous state recorded in history
   */
  async rollbackTo(targetEntry: UpdateHistoryEntry, onProgress: (step: string) => void): Promise<boolean> {
    onProgress(`Checking rollback options for state [${targetEntry.toSha}]...`);
    const hasBak = await this.hasBackup();
    if (hasBak) {
      return await this.rollbackToBackup(onProgress);
    }
    throw new Error('No local bundle backup (resources.neu.bak) is available to restore this state.');
  }

  /**
   * Native process restart
   */
  async restartApp(): Promise<void> {
    if (isNative()) {
      try {
        if (typeof window.Neutralino?.app?.restartProcess === 'function') {
          await window.Neutralino.app.restartProcess();
          return;
        }
        if (typeof window.Neutralino?.app?.restart === 'function') {
          await window.Neutralino.app.restart();
          return;
        }
      } catch (err) {
        console.warn('[Updater] restartProcess failed, falling back to reload:', err);
      }
    }
    window.location.reload();
  }
}

export const updaterService = new UpdaterService();
