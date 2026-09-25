/**
 * Language Server Background Installer Service
 * Provides one-click installation for language servers using system package managers (npm, pip, winget, etc.).
 * Includes robust process unlocking, detailed error diagnostic logging, and actionable failure reporting.
 */

import { ServerConfig, lspServerRegistry } from './lspServerRegistry';
import { lspClient } from './lspClient';
import { notificationService } from '../notification';
import { errorModal } from '../../ui/errorModal';

declare const window: any;

class LspInstallerService {
  private installingServers = new Set<string>();

  /**
   * Check if a server is currently undergoing installation
   */
  isInstalling(serverId: string): boolean {
    return this.installingServers.has(serverId);
  }

  /**
   * Check if the required package manager or runtime is available on the user's PATH
   */
  async canInstall(server: ServerConfig): Promise<{ canInstall: boolean; error?: string; tool?: string }> {
    if (!server.installCommand) {
      return { canInstall: false, error: 'No installation command specified for this server.' };
    }

    if (typeof window === 'undefined' || !window.Neutralino?.os?.execCommand) {
      return { canInstall: false, error: 'Native execution environment is not available.' };
    }

    // Special checks for XML (requires Java or Scoop)
    if (server.id === 'xml') {
      try {
        const javaRes = await window.Neutralino.os.execCommand('where.exe java');
        if (javaRes.exitCode === 0 && javaRes.stdOut && javaRes.stdOut.trim().length > 0) {
          return { canInstall: true, tool: 'java' };
        }
        const scoopRes = await window.Neutralino.os.execCommand('where.exe scoop');
        if (scoopRes.exitCode === 0 && scoopRes.stdOut && scoopRes.stdOut.trim().length > 0) {
          return { canInstall: true, tool: 'scoop' };
        }
        return {
          canInstall: false,
          tool: 'java',
          error: 'Java (JRE/JDK 11+) or Scoop is required to run LemMinX. Please install Java (e.g. OpenJDK 17) or Scoop first.'
        };
      } catch {
        return { canInstall: true };
      }
    }

    const tool = server.packageManager || this.inferTool(server.installCommand);
    if (!tool || tool === 'custom') {
      return { canInstall: true };
    }

    try {
      const res = await window.Neutralino.os.execCommand(`where.exe ${tool}`);
      if (res.exitCode === 0 && res.stdOut && res.stdOut.trim().length > 0) {
        return { canInstall: true, tool };
      }

      // Check fallback path for rustup or go
      let userProfile = '';
      try {
        if (window.Neutralino?.os?.getEnv) {
          userProfile = (await window.Neutralino.os.getEnv('USERPROFILE')) || '';
        }
      } catch {}

      if (tool === 'rustup' && userProfile) {
        try {
          const stats = await window.Neutralino.filesystem.getStats(`${userProfile}\\.cargo\\bin\\rustup.exe`);
          if (stats) return { canInstall: true, tool };
        } catch {}
      }
      if (tool === 'go') {
        const goCandidates = [
          userProfile ? `${userProfile}\\go\\bin\\go.exe` : '',
          'C:\\Program Files\\Go\\bin\\go.exe'
        ].filter(Boolean);
        for (const cand of goCandidates) {
          try {
            const stats = await window.Neutralino.filesystem.getStats(cand);
            if (stats) return { canInstall: true, tool };
          } catch {}
        }
      }

      return {
        canInstall: false,
        tool,
        error: `Required tool "${tool}" was not found on your system PATH. Please install ${tool} first.`
      };
    } catch (err: any) {
      return { canInstall: false, error: err?.message || `Failed to verify ${tool} availability.` };
    }
  }

  /**
   * Execute the installation command in the background, updating notifications and registry
   */
  async installServer(server: ServerConfig): Promise<{ success: boolean; error?: string }> {
    if (!server.installCommand) {
      return { success: false, error: 'No installation command available.' };
    }

    if (this.isInstalling(server.id)) {
      return { success: false, error: 'Installation is already in progress.' };
    }

    // Verify package manager tool or runtime prerequisites
    const preCheck = await this.canInstall(server);
    if (!preCheck.canInstall) {
      notificationService.warn(
        'Installation Prerequisite Missing',
        preCheck.error || `Missing prerequisite to install ${server.name}.`,
        server.installGuide ? [{
          label: 'Copy Manual Guide',
          onClick: () => {
            navigator.clipboard.writeText(server.installGuide || '');
            notificationService.info('Copied', 'Installation guide copied to clipboard.');
          }
        }] : undefined
      );
      return { success: false, error: preCheck.error };
    }

    this.installingServers.add(server.id);

    // Stop and disconnect any existing session and lingering child processes to release Windows file locks (EBUSY)
    try {
      await lspClient.stopServer(server.id);
    } catch (err) {
      console.warn(`[LSP Installer] Warning stopping server ${server.id} before install:`, err);
    }

    // Notify user of installation starting
    const progressNotif = notificationService.show({
      type: 'info',
      title: 'Installing Language Server',
      message: `Installing ${server.name} in background... This may take up to a minute.`,
      durationMs: 0 // Sticky until completed
    });

    // Broadcast status for UI buttons
    window.dispatchEvent(new CustomEvent('gitero:lsp-install-status', {
      detail: { serverId: server.id, status: 'installing' }
    }));

    try {
      // Resolve command to execute
      let fullCmd = server.installCommand;

      // Smart handling for XML: if scoop is available, use scoop; otherwise use automated download
      if (server.id === 'xml') {
        let hasScoop = false;
        try {
          const scoopRes = await window.Neutralino.os.execCommand('where.exe scoop');
          if (scoopRes.exitCode === 0 && scoopRes.stdOut?.trim()) {
            hasScoop = true;
          }
        } catch {}

        if (hasScoop) {
          fullCmd = 'cmd.exe /c "scoop install lemminx"';
        } else {
          fullCmd = 'powershell -NoProfile -Command "if (!(Test-Path $env:LOCALAPPDATA\\Gitero\\lsp\\lemminx)) { New-Item -ItemType Directory -Force -Path $env:LOCALAPPDATA\\Gitero\\lsp\\lemminx | Out-Null }; curl.exe -s -L -o $env:LOCALAPPDATA\\Gitero\\lsp\\lemminx\\lemminx.jar https://download.eclipse.org/lemminx/releases/0.31.2/org.eclipse.lemminx-uber.jar; Set-Content -Path $env:LOCALAPPDATA\\Gitero\\lsp\\lemminx\\lemminx.cmd -Value \'@echo off`r`njava -jar `"%~dp0lemminx.jar`" %*\'"';
        }
      } else {
        // Prepend toolchain paths if applicable to ensure newly installed or user toolchain is found
        let envPrefix = '';
        if (server.packageManager === 'rustup' || server.id === 'rust') {
          envPrefix = 'set PATH=%USERPROFILE%\\.cargo\\bin;%PATH% && ';
        } else if (server.packageManager === 'go' || server.id === 'go') {
          envPrefix = 'set PATH=%USERPROFILE%\\go\\bin;C:\\Program Files\\Go\\bin;%PATH% && ';
        }

        fullCmd = `cmd.exe /c "${envPrefix}${server.installCommand}"`;
      }

      const res = await window.Neutralino.os.execCommand(fullCmd);

      notificationService.dismiss(progressNotif);

      if (res.exitCode === 0) {
        // Clear registry cache so it detects the newly installed binary
        lspServerRegistry.clearCache();
        const verified = await lspServerRegistry.isServerInstalled(server);

        notificationService.success(
          'Language Server Ready',
          `${server.name} has been successfully installed and is ready for use.`,
          [{
            label: 'View Settings',
            onClick: () => {
              window.dispatchEvent(new CustomEvent('gitero:open-settings', { detail: { tab: 'lsp' } }));
            }
          }]
        );

        window.dispatchEvent(new CustomEvent('gitero:lsp-server-installed', {
          detail: { serverId: server.id, server, verified }
        }));

        return { success: true };
      } else {
        // Parse diagnostic failure reason
        const rawErr = (res.stdErr || '').trim();
        const rawOut = (res.stdOut || '').trim();
        const combined = rawErr || rawOut || 'Process exited with non-zero status.';

        // Extract most meaningful line for the notification card
        const lines = combined.split('\n').map((l: string) => l.trim()).filter(Boolean);
        let keyReason = lines[0] || `Exit code ${res.exitCode}`;
        for (const line of lines) {
          if (
            line.includes('No package found') ||
            line.includes('EBUSY') ||
            line.includes('EACCES') ||
            line.includes('access is denied') ||
            line.includes('not recognized') ||
            line.includes('command not found')
          ) {
            keyReason = line;
            break;
          }
        }
        if (keyReason.length > 95) {
          keyReason = keyReason.slice(0, 92) + '...';
        }

        const hints = this.getTroubleshootingHints(server, res.exitCode, combined);

        notificationService.error(
          'Installation Failed',
          `Failed to install ${server.name} (exit code ${res.exitCode}): ${keyReason}`,
          [
            {
              label: 'View Error Log',
              primary: true,
              onClick: () => {
                errorModal.open({
                  title: `Installation Failed: ${server.name}`,
                  subtitle: `The installation command exited with code ${res.exitCode}.`,
                  command: fullCmd,
                  exitCode: res.exitCode,
                  stdout: res.stdOut,
                  stderr: res.stdErr,
                  hints
                });
              }
            },
            {
              label: 'Copy Error Details',
              onClick: () => {
                const report = errorModal.formatFullReport({
                  title: `Installation Failed: ${server.name}`,
                  subtitle: `The installation command exited with code ${res.exitCode}.`,
                  command: fullCmd,
                  exitCode: res.exitCode,
                  stdout: res.stdOut,
                  stderr: res.stdErr,
                  hints
                });
                navigator.clipboard.writeText(report);
                notificationService.info('Copied', 'Error details copied to clipboard.');
              }
            },
            {
              label: 'Copy Command',
              onClick: () => {
                navigator.clipboard.writeText(server.installCommand || fullCmd);
                notificationService.info('Copied', 'Command copied to clipboard.');
              }
            }
          ]
        );

        return { success: false, error: combined };
      }
    } catch (err: any) {
      notificationService.dismiss(progressNotif);
      const errMsg = err?.message || 'Execution failed';
      notificationService.error(
        'Installation Error',
        `An error occurred while installing ${server.name}: ${errMsg}`,
        [
          {
            label: 'Copy Error',
            onClick: () => {
              navigator.clipboard.writeText(`Server: ${server.name}\nError: ${errMsg}`);
              notificationService.info('Copied', 'Error copied to clipboard.');
            }
          }
        ]
      );
      return { success: false, error: errMsg };
    } finally {
      this.installingServers.delete(server.id);
      window.dispatchEvent(new CustomEvent('gitero:lsp-install-status', {
        detail: { serverId: server.id, status: 'idle' }
      }));
    }
  }

  private inferTool(cmd: string): string | null {
    const trimmed = cmd.trim();
    if (trimmed.startsWith('npm')) return 'npm';
    if (trimmed.startsWith('pip')) return 'pip';
    if (trimmed.startsWith('rustup')) return 'rustup';
    if (trimmed.startsWith('go')) return 'go';
    if (trimmed.startsWith('winget')) return 'winget';
    if (trimmed.startsWith('scoop')) return 'scoop';
    return null;
  }

  private getTroubleshootingHints(server: ServerConfig, exitCode: number, errorText: string): string[] {
    const hints: string[] = [];
    const lower = errorText.toLowerCase();

    if (lower.includes('ebusy') || lower.includes('resource busy')) {
      hints.push('A running background process or editor instance is holding a lock on files. Terminating background instances or restarting the IDE usually resolves this.');
    }
    if (lower.includes('no package found') || lower.includes('404 not found')) {
      hints.push('The package name was not found in the package manager registry. Try using an alternative installation method.');
    }
    if (lower.includes('access is denied') || lower.includes('eacces') || lower.includes('administrator')) {
      hints.push('Administrator privileges may be required to install this package system-wide.');
    }
    if (lower.includes('java') || server.id === 'xml') {
      hints.push('Ensure Java (JRE or JDK 11+) is installed and accessible on your system PATH.');
    }
    if (server.installGuide) {
      hints.push(`Manual setup guide: ${server.installGuide}`);
    }

    return hints;
  }
}

export const lspInstaller = new LspInstallerService();
